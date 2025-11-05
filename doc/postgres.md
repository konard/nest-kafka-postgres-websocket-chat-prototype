# PostgreSQL подсистема

## Роль в проекте

PostgreSQL используется как основная реляционная база данных для хранения всех данных приложения чата:
- Пользователи и их учетные записи
- Чаты и их участники
- Сообщения с полной историей
- Метаданные и временные метки

## Архитектура и реализация

### Подключение и конфигурация

База данных интегрирована через TypeORM в модуле NestJS:

**Файл:** `packages/backend/src/app.module.ts:25-42`
```typescript
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get('DB_HOST'),
    port: +configService.get('DB_PORT'),
    username: configService.get('DB_USERNAME'),
    password: configService.get('DB_PASSWORD'),
    database: configService.get('DB_DATABASE'),
    entities: [User, Chat, Message],
    synchronize: true,
    logging: true,
    ssl: false,
    extra: {
      trustServerCertificate: true
    },
  }),
  inject: [ConfigService],
})
```

### Docker конфигурация

**Файл:** `docker-compose.yml:2-16`
```yaml
postgres:
  image: postgres:latest
  ports:
    - "5432:5432"
  environment:
    - POSTGRES_USER=postgres
    - POSTGRES_PASSWORD=postgres
    - POSTGRES_DB=webchat
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5
```

## Сущности базы данных

### User Entity (Пользователи)

**Файл:** `packages/backend/src/user/entities/user.entity.ts:7-73`

Основная сущность пользователя с полями:
- `id` (UUID) - уникальный идентификатор (строка 13-14)
- `email` - уникальный email пользователя (строка 20-21)
- `password` - хэшированный пароль с bcrypt (строка 23-24)
- `name` - отображаемое имя пользователя (строка 38-39)
- `isOnline` - статус онлайн (строка 54-55)
- `createdAt` - дата создания (строка 61-62)

Особенности реализации:
- Автоматическое хэширование пароля перед вставкой через декоратор `@BeforeInsert()` (строки 26-32)
- Валидация пароля через bcrypt.compare (строки 70-72)
- Связи many-to-many с чатами (строки 64-65)
- Связи one-to-many с отправленными сообщениями (строки 67-68)

### Chat Entity (Чаты)

**Файл:** `packages/backend/src/chat/entities/chat.entity.ts:5-30`

Сущность чата:
- `id` (UUID) - уникальный идентификатор
- `name` - название чата
- `createdAt` - дата создания
- `participants` - участники чата (many-to-many связь с User)
- `messages` - сообщения в чате (one-to-many связь с Message)

### Message Entity (Сообщения)

**Файл:** `packages/backend/src/chat/entities/message.entity.ts:5-57`

Сущность сообщения с поддержкой статусов доставки, закрепления и пересылки:

**Основные поля:**
- `id` (UUID) - уникальный идентификатор сообщения
- `content` (text) - текст сообщения
- `senderId` (UUID) - ID отправителя (many-to-one связь с User)
- `chatId` (UUID) - ID чата (many-to-one связь с Chat)
- `createdAt` (timestamp) - время создания

**Статус доставки:**
- `status` (enum) - статус доставки сообщения:
  - `SENT` - отправлено на сервер
  - `DELIVERED` - доставлено получателю
  - `READ` - прочитано получателем

**Функция закрепления (Pinning):**
- `isPinned` (boolean) - флаг закрепленного сообщения (по умолчанию false)
- `pinnedAt` (timestamp, nullable) - время закрепления
- `pinnedBy` (UUID, nullable) - ID пользователя, закрепившего сообщение

**Функция пересылки (Forwarding):**
- `isForwarded` (boolean) - флаг пересланного сообщения (по умолчанию false)
- `forwardedFromId` (UUID, nullable) - ID оригинального сообщения
- `originalSenderId` (UUID, nullable) - ID оригинального отправителя

**Связи:**
```typescript
@ManyToOne(() => Chat, chat => chat.messages)
chat: Chat;

@ManyToOne(() => Message, { nullable: true })
forwardedFrom: Message | null;
```

## Управление соединениями

### Graceful Shutdown

**Файл:** `packages/backend/src/app.module.ts:74-98`

При завершении работы приложения корректно закрываются все соединения:
```typescript
async onApplicationShutdown(signal?: string) {
  // ...
  // Закрываем БД
  await this.dataSource.destroy();
  console.log('Database connection closed');
}
```

## Миграции и синхронизация

В текущей конфигурации используется `synchronize: true` (`packages/backend/src/app.module.ts:35`), что означает автоматическую синхронизацию схемы БД с моделями при каждом запуске. Это удобно для разработки, но в продакшене рекомендуется использовать миграции.

Директория для миграций подготовлена: `packages/backend/src/migrations/`

## Производительность и оптимизация

### Логирование запросов
Включено полное логирование SQL-запросов (`packages/backend/src/app.module.ts:36`):
```typescript
logging: true
```

### Connection Pool
TypeORM автоматически управляет пулом соединений с настройками по умолчанию для PostgreSQL драйвера.

## Использование в сервисах

### ChatService
**Файл:** `packages/backend/src/chat/chat.service.ts`

Основные операции с БД:

**Управление чатами:**
- `createChat(userId1, userId2)` - создание чата между двумя пользователями (строки 22-73)
- `getChat(chatId)` - получение чата по ID (строки 75-99)
- `getUserChats(userId)` - получение списка чатов пользователя (строки 101-126)
- `findChatByParticipants(userId1, userId2)` - поиск чата по участникам (строки 128-186)

**Управление сообщениями:**
- `saveMessage(messageDto)` - сохранение нового сообщения (строки 188-232)
- `getMessage(messageId)` - получение сообщения по ID (строки 234-251)
- `getChatMessages(chatId)` - получение истории сообщений (строки 253-267)
- `updateMessageStatus(messageId, status)` - обновление статуса доставки (строки 269-303)
- `getUndeliveredMessages(userId, chatId?)` - получение непрочитанных сообщений (строки 305-337)

**Закрепление сообщений:**
- `pinMessage(messageId, userId)` - закрепить сообщение (строки 339-395)
- `unpinMessage(messageId, userId)` - открепить сообщение (строки 397-451)
- `getPinnedMessages(chatId)` - получить закрепленные сообщения (строки 453-475)

**Пересылка сообщений:**
- `forwardMessage(messageId, toChatId, userId, additionalContent?)` - переслать сообщение (строки 477-569)
- `forwardMultipleMessages(messageIds, toChatId, userId)` - переслать несколько сообщений (строки 571-599)

### UserService
**Файл:** `packages/backend/src/user/user.service.ts`

Операции с пользователями:
- Создание пользователя (строки 14-39)
- Поиск по email (строки 41-43)
- Поиск по ID (строки 45-47)
- Обновление статуса онлайн (строки 49-55)

## Тестирование

Для тестирования используются моки TypeORM репозиториев, что позволяет изолировать бизнес-логику от БД:

**Файл:** `packages/backend/src/chat/__tests__/chat.service.spec.ts:17-44`
```typescript
const mockChatRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  // ...
};
```

## Мониторинг и Health Checks

Health check для PostgreSQL реализован в Docker Compose (`docker-compose.yml:12-16`):
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U postgres"]
  interval: 10s
  timeout: 5s
  retries: 5
```

## Безопасность

1. **Хэширование паролей**: Используется bcrypt с salt rounds = 10 (`packages/backend/src/user/entities/user.entity.ts:30`)
2. **Параметризованные запросы**: TypeORM автоматически использует параметризованные запросы, защищая от SQL-инъекций
3. **Валидация данных**: Используется class-validator для валидации входящих данных перед сохранением в БД