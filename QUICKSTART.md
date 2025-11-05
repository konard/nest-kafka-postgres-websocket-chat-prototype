# ⚡ Quick Start Guide

Get the chat system up and running in **under 5 minutes**!

## 🎯 Prerequisites

- Docker & Docker Compose installed
- 8GB+ RAM available
- Ports 3000, 4000, 5432, 6379, 9092, 2181 available

## 🚀 Start the Application

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/nest-kafka-postgres-websocket-chat-prototype.git
cd nest-kafka-postgres-websocket-chat-prototype
```

### 2. Start All Services

```bash
docker-compose up -d --build
```

This will start:
- ✅ PostgreSQL (database)
- ✅ Redis (cache & presence)
- ✅ Zookeeper (Kafka dependency)
- ✅ Kafka (event bus)
- ✅ Backend (NestJS)
- ✅ Frontend (Next.js)

### 3. Wait for Services to Initialize

```bash
# Check status
docker-compose ps

# Watch logs (optional)
docker-compose logs -f backend
```

Wait until you see:
```
backend  | Application is running on: http://localhost:4000
```

### 4. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:4000
- **Health Check:** http://localhost:4000/health

## 📱 Try It Out

### 1. Create Two Users

Open two browser windows (or use incognito mode):

**Window 1:**
- Go to http://localhost:3000
- Click "Sign Up"
- Email: `alice@example.com`
- Password: `password123`
- Name: `Alice`

**Window 2:**
- Go to http://localhost:3000 (in incognito)
- Click "Sign Up"
- Email: `bob@example.com`
- Password: `password123`
- Name: `Bob`

### 2. Start Chatting

**In Alice's window:**
- Select `Bob` from the users list
- Type a message and press Enter
- Click the message to mark it as read

**In Bob's window:**
- You should see Alice's message appear instantly!
- Reply to Alice

**Watch for:**
- ✅ Message status indicators (✓ sent, ✓✓ delivered, ✓✓✓ read)
- ✅ Online/offline status
- ✅ Real-time message delivery

### 3. Try Advanced Features

**Pin a Message:**
- Right-click a message → "Pin"
- See pinned messages section appear

**Forward a Message:**
- Right-click a message → "Forward"
- Select recipient

## 🧪 Verify Everything Works

### Check Backend Health

```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "status": "ok",
  "info": {
    "database": {"status":"up"},
    "kafka": {"status":"up"}
  }
}
```

### Check Kafka Topics

```bash
docker exec -it $(docker ps -q -f name=kafka) \
  kafka-topics --list --bootstrap-server localhost:9092
```

You should see topics like:
- `message.created`
- `user.online`
- `chat.created`
- etc.

### Check Redis

```bash
docker exec -it $(docker ps -q -f name=redis) redis-cli -a redispassword
```

```redis
# Check online users
SMEMBERS webchat:users:online

# Check presence
KEYS webchat:user:presence:*
```

## 🔧 Troubleshooting

### Services Not Starting?

```bash
# Stop all services
docker-compose down

# Remove volumes (⚠️ deletes all data)
docker-compose down -v

# Rebuild and start
docker-compose up -d --build
```

### Port Already in Use?

Edit `docker-compose.yml` and change the port mappings:
```yaml
ports:
  - "3001:3000"  # Frontend on 3001 instead of 3000
  - "4001:4000"  # Backend on 4001 instead of 4000
```

### Can't Connect to Backend?

```bash
# Check backend logs
docker-compose logs backend

# Check if it's running
docker-compose ps backend

# Restart backend
docker-compose restart backend
```

### Kafka Issues?

Kafka takes ~30 seconds to start. Be patient!

```bash
# Check Kafka logs
docker-compose logs kafka

# Wait for this message:
# "Kafka Server started"
```

### Frontend Not Loading?

```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend
docker-compose up -d --build frontend
```

## 📊 Monitor Services

### View All Logs

```bash
docker-compose logs -f
```

### View Specific Service

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f kafka
```

### Check Resource Usage

```bash
docker stats
```

## 🛑 Stop the Application

```bash
# Stop services (keeps data)
docker-compose stop

# Stop and remove containers (keeps volumes/data)
docker-compose down

# Stop and remove EVERYTHING (⚠️ deletes all data)
docker-compose down -v
```

## 📚 Next Steps

Now that you have it running:

1. **Explore the API** → [doc/API_REFERENCE.md](doc/API_REFERENCE.md)
2. **Understand Architecture** → [doc/PROJECT_PURPOSE.md](doc/PROJECT_PURPOSE.md)
3. **Start Contributing** → [CONTRIBUTING.md](CONTRIBUTING.md)
4. **Check Kafka Events** → [doc/kafka.md](doc/kafka.md)
5. **Read Full Documentation** → [doc/README.md](doc/README.md)

## 🐛 Still Having Issues?

1. Check the [documentation](doc/README.md)
2. Search [existing issues](https://github.com/YOUR_USERNAME/nest-kafka-postgres-websocket-chat-prototype/issues)
3. Create a [new issue](https://github.com/YOUR_USERNAME/nest-kafka-postgres-websocket-chat-prototype/issues/new)

## 🎉 Success!

You now have a production-ready, event-driven chat system running!

---

**Total time:** ~5 minutes ⚡
**Lines of code to write:** 0 🎯
**Scalability:** Ready for millions 🚀

