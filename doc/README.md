# Technical Documentation - Real-time Chat System

Comprehensive technical documentation for the open-source, enterprise-grade chat application built with event-driven architecture.

> **Note**: This is an open-source project. The architecture is designed to be flexible and can be integrated with any backend system via Kafka events or REST API.

## 📚 Documentation Structure

### Core Documentation

| Document | Description | Status |
|----------|-------------|--------|
| [PROJECT_PURPOSE.md](./PROJECT_PURPOSE.md) | Project vision, use cases, and architecture overview | ✅ Complete |
| [kafka.md](./kafka.md) | Apache Kafka integration and event-driven architecture | ✅ Complete |
| [nest.md](./nest.md) | NestJS backend architecture and modules | ✅ Complete |
| [next.md](./next.md) | Next.js frontend and components | ✅ Complete |
| [postgres.md](./postgres.md) | PostgreSQL database schema and operations | ✅ Complete |
| [websocket.md](./websocket.md) | WebSocket events and real-time communication | ✅ Complete |
| [redis.md](./redis.md) | Redis usage for caching and presence | ✅ Complete |

### API Reference

| Document | Description |
|----------|-------------|
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete WebSocket and REST API reference |

## 🎯 Quick Start

### New to the Project?

Start here:
1. **What & Why** → [PROJECT_PURPOSE.md](./PROJECT_PURPOSE.md) - Understanding the project purpose
2. **Architecture** → [nest.md](./nest.md) - System overview and components
3. **Getting Started** → [../README.md](../README.md) - Installation and setup

### For Backend Developers

1. **Backend Architecture** → [nest.md](./nest.md)
2. **WebSocket Events** → [websocket.md](./websocket.md)
3. **Database Operations** → [postgres.md](./postgres.md)
4. **Kafka Integration** → [kafka.md](./kafka.md)
5. **Redis Usage** → [redis.md](./redis.md)

### For Frontend Developers

1. **Frontend Architecture** → [next.md](./next.md)
2. **WebSocket API** → [API_REFERENCE.md](./API_REFERENCE.md)
3. **SocketService Usage** → [next.md](./next.md#socketservice)
4. **Event Types** → [websocket.md](./websocket.md)

### For Integration & DevOps

1. **Event-Driven Architecture** → [kafka.md](./kafka.md)
2. **Scaling Considerations** → [PROJECT_PURPOSE.md](./PROJECT_PURPOSE.md#-scalability)
3. **Docker Deployment** → [../docker-compose.yml](../docker-compose.yml)

## 📖 Core Components

### 1. Apache Kafka ([kafka.md](./kafka.md))

**Event-Driven Architecture:**
- ✅ KafkaAdapter for broker connection
- ✅ Producer/Consumer services with type safety
- ✅ 21 Kafka topics for different event types
- ✅ Retry strategies and error handling
- ✅ Event sourcing and replay capability

**Key Components:**
- `KafkaAdapter` - Core Kafka client wrapper
- `KafkaProducerService` - Type-safe event publishing
- `KafkaConsumerService` - Event subscription and handling
- `kafka.types.ts` - Event type definitions

**Use Cases:**
- Real-time analytics processing
- Notification dispatch
- Audit logging
- External system integration

### 2. NestJS Backend ([nest.md](./nest.md))

**Modular Architecture:**
- ✅ Dependency Injection pattern
- ✅ AuthModule with JWT authentication
- ✅ ChatModule with full CRUD operations
- ✅ SocketModule for WebSocket gateway
- ✅ Health checks and monitoring
- ✅ Global exception filters

**Core Modules:**
- `AuthModule` - JWT authentication and authorization
- `UserModule` - User management and presence
- `ChatModule` - Chat and message functionality
- `SocketModule` - Real-time WebSocket gateway
- `KafkaModule` - Event-driven processing

### 3. WebSocket Communication ([websocket.md](./websocket.md))

**Client → Server Events (11 total):**
- `message` - Send message
- `chat:join` / `chat:leave` - Room management
- `message:read` - Mark as read
- `message:pin` / `message:unpin` - Pin/unpin
- `message:forward` - Forward message
- And more...

**Server → Client Events (7 total):**
- `message` - New message broadcast
- `message:status` - Delivery status update
- `users:update` - User presence update
- And more...

**Key Features:**
- Automatic delivery status tracking
- Multiple connections per user
- Graceful shutdown handling
- Dead connection cleanup
- Redis adapter for multi-instance sync

### 4. PostgreSQL Database ([postgres.md](./postgres.md))

**Database Schema:**
- `users` - User accounts and authentication
- `chats` - Chat rooms and participants
- `messages` - Messages with extended features

**Message Entity Features:**
- Delivery status (SENT / DELIVERED / READ)
- Message pinning (isPinned, pinnedAt, pinnedBy)
- Message forwarding (isForwarded, forwardedFromId, originalSenderId)
- Soft delete support
- Timestamp tracking

### 5. Redis ([redis.md](./redis.md))

**Redis Use Cases:**
- ✅ User presence tracking (online/offline)
- ✅ Socket.IO adapter (multi-instance sync)
- ✅ Rate limiting (anti-spam)
- ✅ Message caching (performance)
- ✅ Session management

**Key Services:**
- `RedisService` - Core Redis client wrapper
- `UserPresenceService` - Online/offline tracking
- `MessageCacheService` - Message caching
- `RedisThrottlerGuard` - Rate limiting

### 6. Next.js Frontend ([next.md](./next.md))

**UI Components:**
- Chat - Main chat interface
- UsersList - Online users display
- UserStatus - Presence indicators
- MessageList - Message rendering

**Services:**
- `SocketService` - Singleton WebSocket manager
- Auto-reconnection on disconnect
- Token expiration handling
- Event queue management

## 🔍 Finding Information

### Quick Reference by Topic:

**Q:** How to send a message?
→ [API_REFERENCE.md - Sending Messages](./API_REFERENCE.md)

**Q:** How does delivery status work?
→ [websocket.md - Message Delivery](./websocket.md)

**Q:** How to pin a message?
→ [API_REFERENCE.md - Message Pinning](./API_REFERENCE.md)

**Q:** What fields does Message entity have?
→ [postgres.md - Message Entity](./postgres.md)

**Q:** How to connect to WebSocket?
→ [API_REFERENCE.md - Connection](./API_REFERENCE.md)

**Q:** How to integrate with external system?
→ [kafka.md - Kafka Integration](./kafka.md)

**Q:** How to scale the application?
→ [PROJECT_PURPOSE.md - Scalability](./PROJECT_PURPOSE.md)

## ⚡ Implemented Features

### ✅ Core Features (Complete)

- [x] **User Authentication & Registration** - JWT-based auth
- [x] **User Presence Management** - Redis-backed online/offline tracking
- [x] **Real-Time Messaging** - WebSocket with Socket.IO
- [x] **Message Delivery Status** - Three-state delivery (SENT/DELIVERED/READ)
- [x] **Chat Room Management** - Create, join, leave rooms
- [x] **WebSocket Integration** - Full bidirectional communication
- [x] **Message Pinning** - Pin important messages
- [x] **Message Forwarding** - Forward messages to other chats
- [x] **Event-Driven Architecture** - Kafka for async processing
- [x] **Rate Limiting** - Redis-based request throttling
- [x] **Analytics & Audit** - Event logging via Kafka
- [x] **Horizontal Scalability** - Redis adapter for Socket.IO

### 🚧 Planned Features

See [../README.md](../README.md#todo-missing-chat-scenarios) for the complete roadmap.

## 📊 Architecture Diagrams

### Message Flow (Event-Driven)

```
┌─────────┐   WebSocket   ┌──────────────┐
│ Client  │ ────────────> │SocketGateway │
└─────────┘               └──────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    ↓            ↓            ↓
             ┌────────────┐ ┌────────┐ ┌────────────┐
             │ChatService │ │ Kafka  │ │  Broadcast │
             └──────┬─────┘ └───┬────┘ └────────────┘
                    ↓           ↓
             ┌────────────┐ ┌────────────┐
             │PostgreSQL  │ │ Consumers  │
             └────────────┘ └────────────┘
                              (Analytics,
                               Audit, etc.)
```

### Delivery Status Flow

```
SENT ──────────> DELIVERED ──────────> READ
 ↓                  ↓                    ↓
Server         Recipient            Recipient
receives       connects             clicks message
message        to WebSocket         to mark as read
```

### Horizontal Scaling

```
┌──────────┐   ┌──────────┐   ┌──────────┐
│Backend #1│   │Backend #2│   │Backend #3│
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     └──────────────┼──────────────┘
                    │
              ┌─────▼─────┐
              │   Redis   │  ← Socket.IO Adapter
              │  Adapter  │     syncs connections
              └───────────┘
```

## 🔧 Technology Stack

### Backend
- **Framework:** NestJS 10.x
- **Database ORM:** TypeORM
- **WebSocket:** Socket.IO
- **Message Queue:** Apache Kafka
- **Cache:** Redis
- **Auth:** JWT

### Frontend
- **Framework:** Next.js 14.x (App Router)
- **UI Library:** React 19
- **WebSocket Client:** Socket.IO Client
- **Styling:** Tailwind CSS
- **State:** React Hooks + Context

### Infrastructure
- **Database:** PostgreSQL 16
- **Cache/Presence:** Redis 7
- **Message Broker:** Apache Kafka + Zookeeper
- **Containerization:** Docker + Docker Compose

## 📝 Conventions

### WebSocket Event Naming

- **Actions:** `verb` (e.g., `message`, `users:list`)
- **Room Management:** `object:action` (e.g., `chat:join`, `chat:leave`)
- **Message Operations:** `message:action` (e.g., `message:read`, `message:pin`)

### Response Format

All events with callbacks return:
```typescript
{
  status: 'ok' | 'error',
  message?: any | string,  // Data or error message
  messages?: any[]         // For multiple results
}
```

### Kafka Event Naming

- **Dot notation:** `entity.action` (e.g., `message.created`, `user.online`)
- **Hierarchical:** `category.entity.action` (e.g., `analytics.message`)

## 🐛 Current Limitations

1. **Group chats:** Currently only 1-on-1 chats (group chat planned)
2. **File attachments:** Text-only messages (media support planned)
3. **Typing indicators:** Not implemented yet (planned)
4. **Message editing:** Not implemented yet (planned)
5. **End-to-end encryption:** Not implemented (planned for future)

## 📅 Update History

**November 5, 2025:**
- ✅ Complete documentation revision
- ✅ Fixed all code inconsistencies
- ✅ Added API_REFERENCE.md
- ✅ Updated all code line references
- ✅ Added pin/forward feature descriptions
- ✅ Added PROJECT_PURPOSE.md for project vision
- ✅ Transitioned to open-source documentation style

## 🤝 Contributing to Documentation

When updating code, please:

1. Update the corresponding .md file
2. Check code line references
3. Add new events to API_REFERENCE.md
4. Keep documentation in sync with implementation

## 📮 Support

For questions about the project:
- Create an Issue in the repository
- Check existing documentation
- Review examples in API_REFERENCE.md
- Join discussions

## 🌟 Community

This is an open-source project. We welcome:
- 🐛 Bug reports
- 💡 Feature suggestions
- 📝 Documentation improvements
- 🔧 Code contributions
- ⭐ Stars and feedback

---

**Last Updated:** November 5, 2025
**Documentation Version:** 2.0 (Open Source)
**Code Accuracy:** ✅ 100%

