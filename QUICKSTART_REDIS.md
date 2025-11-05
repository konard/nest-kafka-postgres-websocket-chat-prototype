# Redis Integration - Quick Start Guide

## Быстрый старт

### 1. Установка зависимостей

```bash
cd packages/backend
npm install
```

Это установит:
- `ioredis` - клиент Redis для Node.js
- `@socket.io/redis-adapter` - адаптер для Socket.IO
- `@nestjs/throttler` - rate limiting
- `ioredis-mock` - для тестов

### 2. Настройка переменных окружения

Создайте файл `.docker.env` в `packages/backend/`:

```bash
# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redispassword
REDIS_DB=0

# Существующие переменные...
DB_HOST=postgres
DB_PORT=5432
# ...
```

### 3. Запуск с Docker Compose

```bash
# Из корня проекта
docker-compose up -d --build
```

Это запустит:
- ✅ PostgreSQL
- ✅ Zookeeper
- ✅ Kafka
- ✅ **Redis** (новое!)
- ✅ Backend
- ✅ Frontend

### 4. Проверка Redis

```bash
# Проверить статус контейнера
docker ps | grep redis

# Подключиться к Redis CLI
docker exec -it <redis-container-name> redis-cli -a redispassword

# Проверить подключение
redis> PING
PONG

# Проверить количество ключей
redis> DBSIZE
(integer) 0

# Выйти
redis> EXIT
```

### 5. Мониторинг Redis

```bash
# Смотреть логи Redis
docker logs -f <redis-container-name>

# Мониторинг команд в реальном времени
docker exec -it <redis-container-name> redis-cli -a redispassword MONITOR

# Информация о сервере
docker exec -it <redis-container-name> redis-cli -a redispassword INFO

# Статистика по памяти
docker exec -it <redis-container-name> redis-cli -a redispassword INFO memory
```

## Проверка работы функций

### User Presence

1. Откройте два браузера/вкладки
2. Войдите под разными пользователями
3. Проверьте онлайн статус в Redis:

```bash
docker exec -it <redis-container-name> redis-cli -a redispassword

# Получить всех онлайн пользователей
redis> SMEMBERS webchat:users:online

# Проверить присутствие конкретного пользователя
redis> GET webchat:user:presence:{userId}

# Проверить сокеты пользователя
redis> SMEMBERS webchat:user:sockets:{userId}
```

### Session Management

Проверьте сессии пользователя:

```bash
# Получить все сессии пользователя
redis> SMEMBERS webchat:user:sessions:{userId}

# Проверить данные сессии
redis> GET webchat:session:{sessionId}

# Проверить TTL сессии
redis> TTL webchat:session:{sessionId}
```

### Message Cache

Отправьте несколько сообщений и проверьте кеш:

```bash
# Проверить кешированное сообщение
redis> GET webchat:message:{messageId}

# Проверить последние сообщения чата
redis> LRANGE webchat:chat:recent:{chatId} 0 10

# Проверить все сообщения чата
redis> ZRANGE webchat:chat:messages:{chatId} 0 -1

# Проверить закрепленные сообщения
redis> ZRANGE webchat:chat:pinned:{chatId} 0 -1
```

### Rate Limiting

Попробуйте сделать много запросов и проверьте счетчики:

```bash
# Проверить счетчик rate limit
redis> GET webchat:throttle:default:{userId}:/api/messages

# Проверить TTL
redis> TTL webchat:throttle:default:{userId}:/api/messages
```

## WebSocket Events

### Получение онлайн пользователей

В клиенте (frontend):

```javascript
// Получить всех онлайн пользователей
socket.emit('user:get-online', {}, (response) => {
  console.log('Online users:', response);
  // { status: 'ok', users: ['user1', 'user2'], count: 2 }
});

// Получить статус конкретного пользователя
socket.emit('user:get-presence', { userId: 'user-123' }, (response) => {
  console.log('User presence:', response);
  // { status: 'ok', presence: { userId, status: 'online', lastSeen, socketId } }
});
```

## Масштабирование

### Запуск нескольких инстансов backend

1. Обновите `docker-compose.yml`:

```yaml
backend-1:
  build:
    context: .
    dockerfile: packages/backend/Dockerfile
  ports:
    - "4000:4000"
  environment:
    - INSTANCE_ID=backend-1
  # ... остальные настройки

backend-2:
  build:
    context: .
    dockerfile: packages/backend/Dockerfile
  ports:
    - "4001:4000"
  environment:
    - INSTANCE_ID=backend-2
  # ... остальные настройки
```

2. Запустите:

```bash
docker-compose up -d --build
```

3. Проверьте синхронизацию:
   - Подключитесь к `backend-1` с одного клиента
   - Подключитесь к `backend-2` с другого клиента
   - Отправьте сообщение - оно должно появиться у обоих
   - Статус онлайн должен быть синхронизирован

## Troubleshooting

### Redis не запускается

```bash
# Проверить логи
docker logs <redis-container-name>

# Проверить health check
docker inspect <redis-container-name> | grep -A 10 Health

# Перезапустить
docker restart <redis-container-name>
```

### Backend не подключается к Redis

Проверьте переменные окружения:

```bash
# В контейнере backend
docker exec -it <backend-container-name> env | grep REDIS

# Должно быть:
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=redispassword
```

Проверьте логи backend:

```bash
docker logs <backend-container-name> | grep Redis
```

Должны увидеть:
```
[RedisService] Redis clients connected successfully
[RedisService] Redis Client ready
[RedisService] Redis Subscriber ready
[SocketAdapter] Redis adapter configured for Socket.IO
```

### Redis медленно работает

```bash
# Проверить медленные команды
docker exec -it <redis-container-name> redis-cli -a redispassword SLOWLOG GET 10

# Проверить латентность
docker exec -it <redis-container-name> redis-cli -a redispassword --latency

# Проверить большие ключи
docker exec -it <redis-container-name> redis-cli -a redispassword --bigkeys
```

### Утечка памяти

```bash
# Проверить размер БД
docker exec -it <redis-container-name> redis-cli -a redispassword DBSIZE

# Проверить использование памяти
docker exec -it <redis-container-name> redis-cli -a redispassword INFO memory

# Очистить все данные (ОСТОРОЖНО!)
docker exec -it <redis-container-name> redis-cli -a redispassword FLUSHDB
```

## Полезные команды для разработки

### Очистка данных

```bash
# Очистить все онлайн статусы
docker exec -it <redis-container-name> redis-cli -a redispassword DEL webchat:users:online

# Очистить все сессии
docker exec -it <redis-container-name> redis-cli -a redispassword KEYS "webchat:session:*" | xargs docker exec -i <redis-container-name> redis-cli -a redispassword DEL

# Очистить весь кеш сообщений
docker exec -it <redis-container-name> redis-cli -a redispassword KEYS "webchat:message:*" | xargs docker exec -i <redis-container-name> redis-cli -a redispassword DEL

# Очистить всю БД Redis (ОСТОРОЖНО!)
docker exec -it <redis-container-name> redis-cli -a redispassword FLUSHDB
```

### Экспорт/Импорт данных

```bash
# Создать backup
docker exec <redis-container-name> redis-cli -a redispassword BGSAVE
docker cp <redis-container-name>:/data/dump.rdb ./redis-backup-$(date +%Y%m%d).rdb

# Восстановить из backup
docker cp ./redis-backup.rdb <redis-container-name>:/data/dump.rdb
docker restart <redis-container-name>
```

## Performance Testing

### Benchmark Redis

```bash
# Запустить benchmark
docker exec -it <redis-container-name> redis-benchmark -a redispassword -q -n 10000

# Benchmark конкретных команд
docker exec -it <redis-container-name> redis-benchmark -a redispassword -t set,get -n 100000 -q
```

### Мониторинг производительности

```bash
# Отслеживать метрики в реальном времени
docker exec -it <redis-container-name> redis-cli -a redispassword --stat

# Проверить количество подключений
docker exec -it <redis-container-name> redis-cli -a redispassword CLIENT LIST
```

## Дополнительная информация

Подробная документация:
- `doc/redis.md` - полная документация по Redis интеграции
- `REDIS_IMPLEMENTATION.md` - технические детали реализации
- `README.md` - общая информация о проекте

## Support

Если возникли проблемы:
1. Проверьте логи всех контейнеров
2. Убедитесь что все контейнеры запущены (`docker ps`)
3. Проверьте health checks (`docker inspect`)
4. Посмотрите документацию в `doc/redis.md`
5. Проверьте переменные окружения

Удачи! 🚀

