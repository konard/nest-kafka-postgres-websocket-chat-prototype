# Apache Kafka подсистема

## Роль в проекте

Apache Kafka используется как распределенная система обмена сообщениями для:
- Асинхронной обработки сообщений чата
- Гарантированной доставки сообщений
- Масштабирования обработки сообщений
- Event-driven архитектуры
- Разделения ответственности между сервисами
- Обеспечения отказоустойчивости системы

## Архитектура и компоненты

### Docker конфигурация

**Файл:** `docker-compose.yml:18-55`

#### Zookeeper
```yaml
zookeeper:
  image: confluentinc/cp-zookeeper:latest
  ports:
    - "2181:2181"
  environment:
    - ZOOKEEPER_CLIENT_PORT=2181
    - ZOOKEEPER_TICK_TIME=2000
  healthcheck:
    test: ["CMD-SHELL", "echo ruok | nc localhost 2181 || exit 1"]
```

#### Kafka Broker
```yaml
kafka:
  image: confluentinc/cp-kafka:latest
  depends_on:
    zookeeper:
      condition: service_healthy
  ports:
    - "9092:9092"      # Внутренний listener
    - "29092:29092"    # Внешний listener для localhost
  environment:
    - KAFKA_BROKER_ID=1
    - KAFKA_ZOOKEEPER_CONNECT=zookeeper:2181
    - KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:29092
    - KAFKA_AUTO_CREATE_TOPICS_ENABLE=true
```

## KafkaAdapter - основной класс интеграции

### Инициализация и конфигурация

**Файл:** `packages/backend/src/adapters/kafka/kafka.adapter.ts:10-48`

```typescript
@Injectable()
export class KafkaAdapter implements OnModuleInit, OnModuleDestroy {
  private isShuttingDown = false;
  private producer: Producer;
  private consumer: Consumer;
  private readonly kafka: Kafka;
  private isConsumerRunning = false;
  private readonly logger = new Logger(KafkaAdapter.name);
  private pendingSubscriptions: Array<{
    topic: string;
    handler: (message: any) => Promise<void>;
  }> = [];

  constructor(config?: KafkaConfig) {
    this.kafka = new Kafka({
      clientId: config?.clientId || 'webchat',
      brokers: config?.brokers || ['kafka:9092'],
      retry: this.retryOptions,
    });

    this.producer = this.kafka.producer({
      retry: this.retryOptions,
      allowAutoTopicCreation: true
    });

    this.consumer = this.kafka.consumer({
      groupId: config?.groupId || 'webchat-group',
      retry: this.retryOptions,
      readUncommitted: false
    });
  }
}
```

### Retry стратегия

**Файл:** `packages/backend/src/adapters/kafka/kafka.adapter.ts:23-29`

```typescript
private readonly retryOptions: RetryOptions = {
  maxRetryTime: 30000,      // Максимальное время попыток (30 сек)
  initialRetryTime: 100,    // Начальная задержка (100 мс)
  factor: 2,                // Фактор увеличения задержки
  multiplier: 1.5,          // Множитель для расчета задержки
  retries: 5                // Количество попыток
};
```

### Жизненный цикл

**Инициализация** (`packages/backend/src/adapters/kafka/kafka.adapter.ts:50-58`):
```typescript
async onModuleInit() {
  try {
    await this.producer.connect();
    await this.consumer.connect();
    this.logger.log('Successfully connected to Kafka');
  } catch (error) {
    this.logger.error('Failed to connect to Kafka', error);
    throw error;
  }
}
```

**Graceful Shutdown** (`packages/backend/src/adapters/kafka/kafka.adapter.ts:61-83`):
```typescript
async onModuleDestroy() {
  this.isShuttingDown = true;
  try {
    // Перестаем принимать новые сообщения
    if (this.isConsumerRunning) {
      await this.consumer.pause([{ topic: '*' }]);
      this.logger.log('Consumer paused');
    }

    // Ждем завершения текущих операций
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Отключаем producer и consumer
    await Promise.all([
      this.producer.disconnect(),
      this.consumer.disconnect()
    ]);

    this.logger.log('Successfully disconnected from Kafka');
  } catch (error) {
    this.logger.error('Error during graceful shutdown', error);
  }
}
```

## Публикация сообщений

### Метод publish

**Файл:** `packages/backend/src/adapters/kafka/kafka.adapter.ts:85-121`

```typescript
async publish<T>(topic: string, message: T, retries = 3): Promise<void> {
  if (this.isShuttingDown) {
    throw new Error('Service is shutting down');
  }

  let lastError: Error = new Error('Failed to publish message');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: (message as any).id || (message as any).messageId,
            value: JSON.stringify(message),
          },
        ],
      });
      this.logger.debug(`Message published to topic ${topic}`, message);
      return;
    } catch (error) {
      lastError = error as Error;
      this.logger.error(
        `Failed to publish message to topic ${topic} (attempt ${attempt}/${retries})`,
        error
      );

      if (attempt < retries) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

## Подписка и обработка сообщений

### Метод subscribe

**Файл:** `packages/backend/src/adapters/kafka/kafka.adapter.ts:123-205`

```typescript
async subscribe<T>(topic: string, handler: (message: T) => Promise<void>): Promise<void> {
  if (this.isShuttingDown) {
    throw new Error('Service is shutting down');
  }
  try {
    // Добавляем подписку в очередь
    this.pendingSubscriptions.push({ topic, handler });
    this.logger.log(`Subscribing to topic ${topic}`);

    // Если consumer уже запущен, ничего не делаем
    if (this.isConsumerRunning) {
      this.logger.debug(`Consumer already running, subscription to ${topic} queued`);
      return;
    }

    // Подписываемся на топик
    await this.consumer.subscribe({ topic, fromBeginning: true });

    // Запускаем consumer только один раз
    if (!this.isConsumerRunning) {
      this.isConsumerRunning = true;
      await this.consumer.run({
        autoCommit: true,
        autoCommitInterval: 5000,
        autoCommitThreshold: 100,
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const value = message.value?.toString();
            if (value) {
              const parsedMessage = JSON.parse(value);
              // Находим соответствующий handler для топика
              const subscription = this.pendingSubscriptions.find(sub => sub.topic === topic);
              if (subscription) {
                this.logger.debug(`Processing message from topic ${topic}`, {
                  key: message.key?.toString(),
                  partition,
                  offset: message.offset,
                });
                await subscription.handler(parsedMessage);
              }
            }
          } catch (error) {
            this.logger.error(`Error processing message from topic ${topic}`, error);
            // Не выбрасываем ошибку, чтобы не остановить обработку сообщений
          }
        },
      });

      // Обработка ошибок consumer'а
      this.consumer.on('consumer.crash', async (error) => {
        this.logger.error('Consumer crashed', error);
        this.isConsumerRunning = false;
        // Пытаемся переподключиться
        try {
          await this.consumer.connect();
          await this.subscribe(topic, handler);
        } catch (reconnectError) {
          this.logger.error('Failed to reconnect consumer', reconnectError);
        }
      });

      this.consumer.on('consumer.disconnect', () => {
        this.logger.warn('Consumer disconnected');
        this.isConsumerRunning = false;
      });

      this.consumer.on('consumer.connect', () => {
        this.logger.log('Consumer connected');
      });
    }
  } catch (error) {
    this.logger.error(`Failed to subscribe to topic ${topic}`, error);
    throw error;
  }
}
```

## Использование Kafka в проекте

### Текущий статус интеграции

> ⚠️ **Важно:** В текущей реализации проекта Kafka **НЕ используется напрямую в ChatService**. 
> Сообщения обрабатываются через Socket.IO и сохраняются непосредственно в PostgreSQL.

### Архитектура обработки сообщений

В текущей версии приложения:
1. **Клиент** отправляет сообщение через WebSocket (Socket.IO)
2. **SocketGateway** принимает сообщение и вызывает `ChatService.saveMessage()`
3. **ChatService** сохраняет сообщение в PostgreSQL
4. **SocketGateway** рассылает сообщение всем участникам чата через Socket.IO

### Потенциальное использование Kafka

KafkaAdapter готов к использованию и может быть интегрирован для:
- Асинхронной обработки сообщений
- Масштабирования системы на несколько инстансов
- Event sourcing и audit log
- Интеграции с внешними системами

**Пример возможной интеграции:**

```typescript
// В ChatService можно добавить:
async sendMessageWithKafka(message: ChatMessage): Promise<void> {
  // Сохраняем в БД
  await this.saveMessage(message);
  
  // Отправляем в Kafka для дополнительной обработки
  await this.kafkaAdapter.publish('chat-messages', {
    messageId: message.id,
    chatId: message.chatId,
    senderId: message.senderId,
    content: message.content,
    timestamp: message.createdAt,
  });
}

// Подписка на события
async onModuleInit() {
  await this.kafkaAdapter.subscribe('chat-messages', async (message) => {
    // Дополнительная обработка (аналитика, уведомления и т.д.)
    this.logger.log(`Processing message from Kafka: ${message.messageId}`);
  });
}
```

## Топики Kafka

### chat-messages

Основной топик для сообщений чата:
- **Производитель**: ChatService при отправке сообщения
- **Потребитель**: ChatService для обработки и рассылки через WebSocket
- **Формат данных**:
```typescript
{
  messageId: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: string;
}
```

### message-delivery-status

Топик для статусов доставки (планируется):
- Подтверждение доставки
- Подтверждение прочтения
- Ошибки доставки

## Мониторинг и отладка

### Health Check

**Файл:** `docker-compose.yml:51-55`

```yaml
healthcheck:
  test: ["CMD-SHELL", "kafka-topics --bootstrap-server localhost:9092 --list"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### Логирование

Все операции с Kafka логируются через NestJS Logger:
- Успешное подключение/отключение
- Публикация сообщений
- Получение сообщений
- Ошибки и повторные попытки

## Тестирование

### Mock адаптер для тестов

**Файл:** `packages/backend/src/adapters/kafka/mock-kafka.adapter.ts:1-28`

```typescript
export class MockKafkaAdapter {
  private messages: Map<string, any[]> = new Map();

  async publish<T>(topic: string, message: T): Promise<void> {
    if (!this.messages.has(topic)) {
      this.messages.set(topic, []);
    }
    this.messages.get(topic)?.push(message);
  }

  async subscribe(topic: string, handler: (message: any) => Promise<void>): Promise<void> {
    // Mock implementation
  }

  getPublishedMessages(topic: string): any[] {
    return this.messages.get(topic) || [];
  }
}
```

### Unit тесты

**Файл:** `packages/backend/src/adapters/kafka/__tests__/kafka.adapter.spec.ts`

Тестирование:
- Подключения к Kafka
- Публикации сообщений
- Обработки ошибок
- Retry логики
- Graceful shutdown

## Производительность и оптимизация

### Batching

Возможность отправки сообщений батчами для увеличения пропускной способности.

### Partitioning

Использование ключей сообщений для распределения по партициям:
- Ключ: `messageId` или `chatId`
- Обеспечивает порядок сообщений в рамках чата

### Consumer Groups

Использование групп потребителей для горизонтального масштабирования:
- Group ID: `webchat-group`
- Автоматическая балансировка нагрузки между инстансами

## Безопасность

### Аутентификация

В production окружении рекомендуется настроить:
- SASL/SCRAM аутентификацию
- SSL/TLS шифрование
- ACL для контроля доступа к топикам

### Валидация данных

Все сообщения валидируются перед отправкой и после получения:
- JSON схема валидация
- Проверка обязательных полей
- Санитизация контента

## Отказоустойчивость

### Репликация

Настройка репликации для критичных топиков:
- `KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR=1` (для dev)
- Рекомендуется 3+ для production

### Обработка ошибок

- Автоматические повторные попытки с экспоненциальной задержкой
- Dead Letter Queue для необработанных сообщений
- Circuit Breaker паттерн для предотвращения каскадных сбоев

## Интеграция с AppModule

**Файл:** `packages/backend/src/app.module.ts:60-71`

```typescript
{
  provide: KafkaAdapter,
  useFactory: (configService: ConfigService) => {
    const isDocker = configService.get('IS_DOCKER', 'false') === 'true';
    return new KafkaAdapter({
      clientId: configService.get('KAFKA_CLIENT_ID') || 'webchat',
      brokers: [configService.get('KAFKA_BROKERS') || (isDocker ? 'kafka:9092' : 'localhost:29092')],
      groupId: configService.get('KAFKA_GROUP_ID') || 'webchat-group'
    });
  },
  inject: [ConfigService],
}
```

## Конфигурация

### Environment переменные

- `KAFKA_CLIENT_ID` - идентификатор клиента Kafka
- `KAFKA_BROKERS` - адреса брокеров (comma-separated)
- `KAFKA_GROUP_ID` - идентификатор группы потребителей
- `IS_DOCKER` - флаг для определения окружения