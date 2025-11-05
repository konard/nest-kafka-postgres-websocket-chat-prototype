# Redis Integration

## Обзор

Redis интегрирован в приложение для следующих целей:
1. **Socket.IO Adapter** - Масштабирование WebSocket соединений
2. **User Presence** - Управление онлайн-статусом пользователей
3. **Session Store** - Хранение сессий пользователей
4. **Rate Limiting** - Ограничение частоты запросов
5. **Message Caching** - Кеширование сообщений для быстрого доступа

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                      Application Layer                       │
├─────────────────────────────────────────────────────────────┤
│  Socket.IO │ UserPresence │ Session │ RateLimit │ MessageCache │
│   Adapter  │   Service    │ Service │   Guard   │   Service    │
├─────────────────────────────────────────────────────────────┤
│                      RedisService                            │
│              (Global, Singleton, IoRedis Client)             │
├─────────────────────────────────────────────────────────────┤
│                      Redis Server                            │
│              (Docker Container, Persistent)                  │
└─────────────────────────────────────────────────────────────┘
```

## Конфигурация

### Docker Compose

Redis запускается как отдельный контейнер:

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-redispassword}
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
  restart: unless-stopped
```

### Переменные окружения

```bash
REDIS_HOST=redis         # Хост Redis (для Docker)
REDIS_PORT=6379          # Порт Redis
REDIS_PASSWORD=redispassword  # Пароль для Redis
REDIS_DB=0               # Номер базы данных (опционально)
```

## RedisService

### Основной сервис для работы с Redis

**Файл**: `packages/backend/src/redis/redis.service.ts`

RedisService - это глобальный сервис, предоставляющий методы для работы с Redis.

### Основные методы

#### String операции
- `get(key)` - Получить значение
- `set(key, value, ttl?)` - Установить значение с опциональным TTL
- `del(key)` - Удалить ключ
- `exists(key)` - Проверить существование ключа
- `expire(key, seconds)` - Установить TTL
- `ttl(key)` - Получить оставшееся время жизни
- `incr(key)` - Инкрементировать значение
- `decr(key)` - Декрементировать значение

#### Hash операции
- `hget(key, field)` - Получить значение поля
- `hset(key, field, value)` - Установить значение поля
- `hgetall(key)` - Получить все поля
- `hdel(key, field)` - Удалить поле
- `hexists(key, field)` - Проверить существование поля
- `hkeys(key)` - Получить все ключи
- `hvals(key)` - Получить все значения
- `hlen(key)` - Получить количество полей

#### Set операции
- `sadd(key, ...members)` - Добавить элементы
- `srem(key, ...members)` - Удалить элементы
- `smembers(key)` - Получить все элементы
- `sismember(key, member)` - Проверить принадлежность
- `scard(key)` - Получить размер множества

#### Sorted Set операции
- `zadd(key, score, member)` - Добавить элемент с score
- `zrem(key, member)` - Удалить элемент
- `zrange(key, start, stop)` - Получить диапазон
- `zrangebyscore(key, min, max)` - Получить по score
- `zcard(key)` - Получить размер
- `zscore(key, member)` - Получить score элемента

#### List операции
- `lpush(key, ...values)` - Добавить в начало
- `rpush(key, ...values)` - Добавить в конец
- `lpop(key)` - Удалить с начала
- `rpop(key)` - Удалить с конца
- `lrange(key, start, stop)` - Получить диапазон
- `llen(key)` - Получить длину списка

#### Pub/Sub операции
- `publish(channel, message)` - Опубликовать сообщение
- `subscribe(channel, handler)` - Подписаться на канал
- `unsubscribe(channel)` - Отписаться от канала

### Управление соединением

```typescript
// Получить клиента Redis
const client = redisService.getClient();

// Получить subscriber клиента
const subscriber = redisService.getSubscriber();

// Проверить готовность
const isReady = redisService.isReady();

// Ping Redis
await redisService.ping();
```

### Retry механизм

RedisService автоматически пытается переподключиться при потере соединения:

```typescript
retryStrategy: (times: number) => {
  if (this.isShuttingDown) {
    return undefined; // Прекращаем повторные попытки при выключении
  }
  const delay = Math.min(times * 50, 2000);
  return delay;
}
```

## Socket.IO Redis Adapter

### Назначение

Позволяет масштабировать WebSocket соединения на несколько инстансов приложения.

**Файл**: `packages/backend/src/socket/socket.adapter.ts`

### Как работает

```typescript
private setupRedisAdapter(): void {
  const pubClient = this.redisService.getClient();
  const subClient = this.redisService.getSubscriber();

  const redisAdapter = createAdapter(pubClient, subClient);
  this.server.adapter(redisAdapter);
}
```

Socket.IO использует Redis Pub/Sub для синхронизации событий между несколькими серверами:

```
┌──────────────┐      ┌──────────────┐
│  Backend 1   │      │  Backend 2   │
│  Socket.IO   │      │  Socket.IO   │
└──────┬───────┘      └──────┬───────┘
       │                     │
       │   Pub/Sub Channel   │
       └─────────┬───────────┘
                 │
           ┌─────▼─────┐
           │   Redis   │
           └───────────┘
```

### Масштабирование

С Redis Adapter можно запустить несколько инстансов backend:

```bash
# Backend Instance 1
PORT=4000 npm start

# Backend Instance 2  
PORT=4001 npm start

# Backend Instance 3
PORT=4002 npm start
```

Все инстансы будут синхронизироваться через Redis.

## User Presence Service

### Назначение

Управление онлайн-статусом пользователей в реальном времени.

**Файл**: `packages/backend/src/user/user-presence.service.ts`

### Структура данных

#### User Presence
```typescript
interface UserPresence {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
  socketId?: string;
}
```

### Redis Keys

- `webchat:user:presence:{userId}` - Данные о присутствии пользователя
- `webchat:users:online` - Set всех онлайн пользователей
- `webchat:user:sockets:{userId}` - Set сокетов пользователя

### Основные методы

```typescript
// Установить онлайн статус
await userPresenceService.setOnline(userId, socketId);

// Установить оффлайн статус
await userPresenceService.setOffline(userId, socketId);

// Получить статус пользователя
const presence = await userPresenceService.getUserPresence(userId);

// Проверить, онлайн ли пользователь
const isOnline = await userPresenceService.isUserOnline(userId);

// Получить всех онлайн пользователей
const onlineUsers = await userPresenceService.getOnlineUsers();

// Получить количество онлайн пользователей
const count = await userPresenceService.getOnlineUsersCount();
```

### Интеграция с Socket.IO

```typescript
// При подключении
async handleConnection(client: Socket) {
  await this.userPresenceService.setOnline(user.id, client.id);
  this.broadcastUserStatus(user.id, true);
}

// При отключении
handleDisconnect(client: Socket) {
  await this.userPresenceService.setOffline(clientInfo.userId, client.id);
  if (!hasOtherConnections) {
    this.broadcastUserStatus(clientInfo.userId, false);
  }
}
```

### TTL и очистка

- Присутствие онлайн пользователя хранится 5 минут (автообновление)
- Присутствие оффлайн пользователя хранится 24 часа
- Периодическая очистка устаревших данных каждые 30 секунд

## Session Service

### Назначение

Управление пользовательскими сессиями с поддержкой blacklist токенов.

**Файл**: `packages/backend/src/auth/session.service.ts`

### Структура данных

```typescript
interface UserSession {
  userId: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  ip?: string;
  userAgent?: string;
  refreshToken?: string;
}
```

### Redis Keys

- `webchat:session:{sessionId}` - Данные сессии
- `webchat:user:sessions:{userId}` - Set сессий пользователя
- `webchat:token:blacklist:{token}` - Blacklist токенов

### Основные методы

```typescript
// Создать сессию
const sessionId = await sessionService.createSession(
  userId,
  token,
  expiresIn,
  { ip, userAgent }
);

// Получить сессию
const session = await sessionService.getSession(sessionId);

// Валидировать сессию
const isValid = await sessionService.validateSession(sessionId);

// Обновить сессию
await sessionService.updateSession(sessionId, { /* updates */ });

// Удалить сессию
await sessionService.deleteSession(sessionId);

// Обновить время жизни
await sessionService.refreshSession(sessionId, newExpiresIn);

// Получить все сессии пользователя
const sessions = await sessionService.getUserSessions(userId);

// Удалить все сессии пользователя
await sessionService.deleteAllUserSessions(userId);

// Добавить токен в blacklist
await sessionService.blacklistToken(token, expiresIn);

// Проверить blacklist
const isBlacklisted = await sessionService.isTokenBlacklisted(token);
```

### Use Cases

#### Logout из всех устройств
```typescript
await sessionService.deleteAllUserSessions(userId);
```

#### Logout из других устройств
```typescript
await sessionService.deleteOtherUserSessions(userId, currentSessionId);
```

#### Отозвать токен
```typescript
await sessionService.blacklistToken(token, expiresIn);
```

## Rate Limiting

### Назначение

Ограничение частоты запросов к API для защиты от abuse.

**Файл**: `packages/backend/src/common/guards/redis-throttler.guard.ts`

### Конфигурация

```typescript
ThrottlerModule.forRoot([
  {
    name: 'default',
    ttl: 60000,  // 60 секунд
    limit: 100,  // 100 запросов
  },
  {
    name: 'strict',
    ttl: 60000,
    limit: 10,   // 10 запросов для строгих эндпоинтов
  },
])
```

### Как работает

Guard использует Redis INCR команду для подсчета запросов:

```typescript
protected async handleRequest(context, limit, ttl, throttler) {
  const key = this.generateKey(context, throttler.name);
  const current = await this.incrementKey(key, ttl);
  
  if (current > limit) {
    throw new ThrottlerException('Too Many Requests');
  }
  
  return true;
}
```

### Redis Keys

Формат: `webchat:throttle:{name}:{userId}:{route}`

Пример: `webchat:throttle:default:user-123:/api/messages`

### Применение к эндпоинтам

```typescript
// Использовать default настройки
@Get('/messages')
async getMessages() { }

// Использовать strict настройки
@Throttle({ strict: { limit: 10, ttl: 60000 } })
@Post('/send-message')
async sendMessage() { }

// Отключить rate limiting
@SkipThrottle()
@Get('/public')
async publicEndpoint() { }
```

### Graceful degradation

Если Redis недоступен, guard пропускает запросы, чтобы не блокировать приложение:

```typescript
try {
  // Rate limiting logic
} catch (error) {
  if (error instanceof ThrottlerException) {
    throw error;
  }
  // Если Redis недоступен, пропускаем запрос
  return true;
}
```

## Message Cache Service

### Назначение

Кеширование сообщений для быстрого доступа и уменьшения нагрузки на PostgreSQL.

**Файл**: `packages/backend/src/chat/message-cache.service.ts`

### Redis Keys

- `webchat:message:{messageId}` - Кешированное сообщение (TTL: 1 час)
- `webchat:chat:messages:{chatId}` - Sorted Set сообщений чата (по времени)
- `webchat:chat:recent:{chatId}` - List последних 50 сообщений (быстрый доступ)
- `webchat:chat:pinned:{chatId}` - Sorted Set закрепленных сообщений

### Стратегия кеширования

#### Write-Through Cache
Сообщения кешируются при создании:

```typescript
// 1. Сохранить в PostgreSQL
const message = await messageRepository.save(newMessage);

// 2. Закешировать в Redis
await messageCacheService.cacheMessage(message);
```

#### Cache-Aside для чтения
```typescript
// 1. Попытаться получить из кеша
let message = await messageCacheService.getCachedMessage(messageId);

// 2. Если нет - получить из БД и закешировать
if (!message) {
  message = await messageRepository.findOne({ where: { id: messageId } });
  if (message) {
    await messageCacheService.cacheMessage(message);
  }
}
```

### Основные методы

```typescript
// Кешировать сообщение
await messageCacheService.cacheMessage(message);

// Получить кешированное сообщение
const message = await messageCacheService.getCachedMessage(messageId);

// Обновить кеш
await messageCacheService.updateCachedMessage(message);

// Удалить из кеша
await messageCacheService.deleteCachedMessage(messageId, chatId);

// Получить последние сообщения
const recent = await messageCacheService.getRecentMessages(chatId, 20);

// Кешировать закрепленное сообщение
await messageCacheService.cachePinnedMessage(message);

// Получить закрепленные сообщения
const pinned = await messageCacheService.getPinnedMessages(chatId);

// Массовое кеширование
await messageCacheService.cacheMultipleMessages(messages);

// Прогрев кеша
await messageCacheService.warmUpCache(chatId, messages);

// Инвалидация кеша
await messageCacheService.invalidateCache(chatId);
```

### Cache Warming

При первом запросе к чату можно прогреть кеш:

```typescript
const messages = await messageRepository.find({
  where: { chatId },
  order: { createdAt: 'DESC' },
  take: 50
});

await messageCacheService.warmUpCache(chatId, messages);
```

### Статистика кеша

```typescript
const stats = await messageCacheService.getStats();
// { totalCachedMessages: 1500, totalChats: 25 }
```

## Health Checks

Добавить Redis health check в `HealthController`:

```typescript
@Get()
@HealthCheck()
check() {
  return this.health.check([
    () => this.db.pingCheck('database'),
    () => this.redisHealthIndicator.checkHealth('redis'),
  ]);
}
```

## Monitoring и Debugging

### Redis CLI

Подключение к Redis в Docker:

```bash
docker exec -it <redis-container> redis-cli -a redispassword
```

### Полезные команды

```bash
# Информация о сервере
INFO

# Статистика по памяти
INFO memory

# Статистика по клиентам
CLIENT LIST

# Количество ключей
DBSIZE

# Поиск ключей (осторожно на продакшене!)
KEYS webchat:*

# Мониторинг команд в реальном времени
MONITOR

# TTL ключа
TTL webchat:user:presence:user-123

# Тип ключа
TYPE webchat:users:online

# Размер Set
SCARD webchat:users:online

# Элементы Set
SMEMBERS webchat:users:online
```

### Логирование

RedisService логирует все важные события:

- Подключение/отключение
- Ошибки
- Reconnection attempts
- Command execution (debug level)

```typescript
this.logger.log('Redis clients connected successfully');
this.logger.error('Redis client error:', error);
this.logger.warn('Retrying Redis connection...');
this.logger.debug('Message published to topic', message);
```

## Best Practices

### 1. Используйте TTL

Всегда устанавливайте TTL для временных данных:

```typescript
await redisService.set(key, value, 3600); // 1 час
```

### 2. Prefix для ключей

Все ключи имеют prefix `webchat:` для изоляции:

```typescript
keyPrefix: 'webchat:'
```

### 3. Graceful degradation

Приложение должно работать даже если Redis недоступен:

```typescript
try {
  await redisService.get(key);
} catch (error) {
  this.logger.error('Redis error, falling back to DB', error);
  // Fallback to database
}
```

### 4. Избегайте KEYS в продакшене

`KEYS *` блокирует Redis. Используйте `SCAN`:

```typescript
// Плохо
const keys = await redisService.keys('webchat:*');

// Хорошо - используйте отдельные структуры данных
const onlineUsers = await redisService.smembers('users:online');
```

### 5. Пакетные операции

Используйте pipeline для множественных операций:

```typescript
const pipeline = redisService.getClient().pipeline();
pipeline.set('key1', 'value1');
pipeline.set('key2', 'value2');
pipeline.set('key3', 'value3');
await pipeline.exec();
```

### 6. Мониторинг памяти

Отслеживайте использование памяти Redis:

```bash
redis-cli INFO memory | grep used_memory_human
```

### 7. Persistence

Redis настроен с AOF (Append-Only File) для долговечности данных:

```yaml
command: redis-server --appendonly yes
```

## Performance Considerations

### Memory Usage

- Оптимизируйте размер кешированных данных
- Используйте сжатие для больших объектов
- Регулярно очищайте устаревшие данные

### Connection Pooling

IoRedis автоматически управляет пулом соединений:

```typescript
maxRetriesPerRequest: 3,
enableReadyCheck: true,
enableOfflineQueue: true,
```

### Network Latency

Минимизируйте round trips:
- Используйте pipeline для множественных команд
- Используйте структуры данных Redis вместо множественных ключей
- Кешируйте часто используемые данные

## Troubleshooting

### Redis недоступен

**Симптомы**: Логи показывают ошибки подключения к Redis

**Решение**:
```bash
# Проверить статус контейнера
docker ps | grep redis

# Проверить логи
docker logs <redis-container>

# Перезапустить Redis
docker restart <redis-container>
```

### Медленные запросы

**Симптомы**: Высокая латентность запросов

**Решение**:
```bash
# Проверить медленные команды
redis-cli SLOWLOG GET 10

# Мониторинг в реальном времени
redis-cli --latency
```

### Утечка памяти

**Симптомы**: Redis использует слишком много памяти

**Решение**:
```bash
# Проверить размер БД
redis-cli DBSIZE

# Проверить большие ключи
redis-cli --bigkeys

# Очистить все данные (осторожно!)
redis-cli FLUSHDB
```

### Проблемы с TTL

**Симптомы**: Данные не удаляются автоматически

**Решение**:
```bash
# Проверить TTL
redis-cli TTL webchat:message:123

# Установить TTL вручную
redis-cli EXPIRE webchat:message:123 3600
```

## Migration and Maintenance

### Очистка старых данных

```typescript
// Очистить все кеши
await messageCacheService.clearAllCache();
await userPresenceService.clearAllPresence();
await sessionService.clearAllSessions();
```

### Backup

```bash
# Создать snapshot
redis-cli BGSAVE

# Backup файла
docker cp <redis-container>:/data/dump.rdb ./backup/
```

### Restore

```bash
# Восстановить из backup
docker cp ./backup/dump.rdb <redis-container>:/data/
docker restart <redis-container>
```

## Future Enhancements

Возможные улучшения Redis интеграции:

1. **Redis Cluster** - Для horizontal scaling
2. **Redis Sentinel** - Для high availability
3. **Lua Scripts** - Для атомарных операций
4. **Geo-распределенный кеш** - Для multi-region deployments
5. **Redis Streams** - Для event sourcing
6. **Redis TimeSeries** - Для метрик и аналитики

## Заключение

Redis играет критическую роль в архитектуре приложения, обеспечивая:
- Масштабируемость WebSocket соединений
- Быстрый доступ к данным о присутствии пользователей
- Надежное хранение сессий
- Защиту от abuse через rate limiting
- Значительное ускорение доступа к сообщениям

Правильная настройка и использование Redis существенно повышает производительность и надежность системы.

