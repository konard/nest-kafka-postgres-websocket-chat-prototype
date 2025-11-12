# Enterprise-grade Real-time Chat System

An **open-source**, production-ready, scalable real-time chat application built with modern event-driven architecture.

**Built with**: NestJS, Next.js, Apache Kafka, PostgreSQL, Redis, Socket.io

[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-blue.svg)](docker-compose.yml)
[![Event Driven](https://img.shields.io/badge/Architecture-Event--Driven-orange.svg)](doc/kafka.md)

---

## 🌟 Why This Project?

This is **not just another chat demo** - it's a **production-ready foundation** for building scalable real-time applications.

### Perfect for:
- 🎮 **Gaming platforms** (in-game chat, guilds, parties)
- 💼 **Business apps** (team collaboration, customer support)
- 🌐 **Social networks** (messaging, communities)
- 🏫 **Educational platforms** (virtual classrooms, Q&A)
- 🤖 **AI applications** (chatbots, assistants, agents)

### What makes it different:
- ✅ **Event-driven architecture** with Kafka (not just WebSocket!)
- ✅ **Horizontal scalability** out of the box
- ✅ **Redis adapter** for multi-instance WebSocket sync
- ✅ **Complete feature set** (pinning, forwarding, presence, rate limiting)
- ✅ **Analytics & audit logging** built-in
- ✅ **Well-documented** and easy to extend

---

## 🚀 Quick Start

**Want to get started in under 5 minutes?** → [⚡ QUICKSTART GUIDE](QUICKSTART.md)

### TL;DR

```bash
# Clone the repo
git clone <repo-url>
cd nest-kafka-postgres-websocket-chat-prototype

# Start everything
docker-compose up -d --build

# Access the app
# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
```

That's it! 🎉

## Current Features (Implemented Scenarios)

### 1. User Authentication & Registration
- ✅ User signup with email, name, and password
- ✅ User login with email and password
- ✅ JWT token-based authentication
- ✅ Persistent authentication (token stored in localStorage)

### 2. User Presence Management
- ✅ Real-time online/offline status tracking powered by Redis
- ✅ Automatic status updates on connection/disconnection
- ✅ Visual indicators for user availability
- ✅ Multi-device support (tracks all user's sockets)
- ✅ Last seen timestamp tracking
- ✅ Scalable presence across multiple server instances

### 3. Real-Time Messaging
- ✅ Send text messages in real-time
- ✅ Receive messages instantly via WebSocket
- ✅ Message persistence in PostgreSQL database
- ✅ Auto-scrolling to latest messages

### 4. Message Delivery Status
- ✅ **Sent** (✓) - Message sent to server
- ✅ **Delivered** (✓✓) - Message delivered to recipient's device
- ✅ **Read** (✓✓✓) - Message read by recipient (click on message to mark as read)

### 5. Chat Room Management
- ✅ Create private chat between two users
- ✅ Join/leave chat rooms
- ✅ Automatic room creation on first message
- ✅ Chat history persistence

### 6. WebSocket Integration
- ✅ Real-time bidirectional communication
- ✅ Automatic reconnection on connection loss
- ✅ Connection status indicators
- ✅ Room-based message broadcasting

### 7. Backend Architecture
- ✅ NestJS modular architecture
- ✅ TypeORM with PostgreSQL for data persistence
- ✅ Redis for caching, sessions, and user presence
- ✅ **Kafka event-driven architecture** for async processing
- ✅ **21 Kafka topics** for different event types
- ✅ **Real-time analytics** through Kafka streams
- ✅ **Audit logging** for all user actions
- ✅ **Notification system** via Kafka events
- ✅ Socket.io for real-time communication with Redis adapter
- ✅ JWT-based WebSocket authentication
- ✅ Rate limiting with Redis
- ✅ Message caching for performance

## TODO: Missing Chat Scenarios

### High Priority Features

#### 1. Message Pinning
- [x] Pin important messages to chat top
- [x] Unpin messages
- [x] Display pinned messages section
- [x] Sync pinned messages across devices
- [ ] Maximum pinned messages limit (configurable)

#### 2. Message Forwarding
- [x] Forward messages to other chats/users
- [x] Forward multiple messages at once
- [x] Include original sender information
- [x] Forward with additional comment

#### 3. Message Editing & Deletion
- [ ] Edit sent messages within time limit
- [ ] Show "edited" indicator
- [ ] Delete messages for self
- [ ] Delete messages for everyone
- [ ] Message edit history

#### 4. Message Search
- [ ] Search messages by content
- [ ] Search by sender
- [ ] Search by date range
- [ ] Jump to message in chat
- [ ] Highlight search results

### Medium Priority Features

#### 5. Message Reactions/Emojis
- [ ] React to messages with emojis
- [ ] Multiple reactions per message
- [ ] Custom emoji support
- [ ] Reaction notifications
- [ ] Most used emojis section

#### 6. Group Chats
- [ ] Create group chats with multiple users
- [ ] Add/remove participants
- [ ] Group admins and permissions
- [ ] Group info and settings
- [ ] Leave group functionality

#### 7. Typing Indicators
- [ ] Show when user is typing
- [ ] Multiple users typing in group
- [ ] Typing timeout handling
- [ ] Optimize typing event frequency

#### 8. Message Threading/Replies
- [ ] Reply to specific messages
- [ ] Quote messages
- [ ] Thread view for conversations
- [ ] Thread notifications
- [ ] Jump to original message

#### 9. Message Encryption
- [ ] End-to-end encryption
- [ ] Key exchange protocol
- [ ] Encrypted file sharing
- [ ] Backup encryption keys
- [ ] Security indicators

#### 10. Chat Customization
- [ ] Custom chat backgrounds
- [ ] Theme selection (dark/light/custom)
- [ ] Font size adjustment
- [ ] Notification sounds
- [ ] Chat color schemes

#### 11. Advanced Notifications
- [ ] Push notifications
- [ ] Email notifications
- [ ] Notification preferences
- [ ] Do not disturb mode
- [ ] Notification grouping

### Low Priority Features

#### 12. File & Media Sharing
- [ ] Send images (JPEG, PNG, GIF)
- [ ] Send documents (PDF, DOCX, etc.)
- [ ] Send videos with preview
- [ ] Send voice messages
- [ ] File size limitations
- [ ] Image compression & thumbnails
- [ ] Download progress indicators

#### 13. Voice & Video Calls
- [ ] One-on-one voice calls
- [ ] One-on-one video calls
- [ ] Group calls
- [ ] Screen sharing
- [ ] Call history
- [ ] WebRTC integration

#### 14. Message Scheduling
- [ ] Schedule messages for later
- [ ] Recurring messages
- [ ] Edit scheduled messages
- [ ] Cancel scheduled messages
- [ ] Timezone handling

#### 15. Message Translation
- [ ] Auto-detect language
- [ ] Translate messages on demand
- [ ] Preferred language settings
- [ ] Original message preservation

#### 16. Chat Backup & Export
- [ ] Export chat history
- [ ] Backup to cloud
- [ ] Import chat history
- [ ] Multiple export formats (JSON, CSV, PDF)

#### 17. User Blocking & Reporting
- [ ] Block users
- [ ] Report inappropriate content
- [ ] Blocked users list
- [ ] Moderation queue
- [ ] Auto-moderation rules

#### 18. Message Templates & Quick Replies
- [ ] Save message templates
- [ ] Quick reply suggestions
- [ ] Canned responses
- [ ] Template categories
- [ ] Keyboard shortcuts

#### 19. Location Sharing
- [ ] Share current location
- [ ] Share live location
- [ ] Location history
- [ ] Map integration
- [ ] Privacy controls

#### 20. Read Receipts Controls
- [ ] Disable read receipts
- [ ] Disable typing indicators
- [ ] Privacy settings per user
- [ ] Last seen status control

## Architecture

### Frontend
- Next.js 13+ with App Router
- React Hooks for state management
- Socket.io client for WebSocket
- Tailwind CSS for styling

### Backend
- NestJS framework
- PostgreSQL with TypeORM
- Redis for caching, sessions, and presence
- Apache Kafka for message queue
- Socket.io for real-time events
- JWT authentication

### Database Schema
- Users table
- Messages table
- Chats table
- Chat participants junction table

## Development

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- PostgreSQL
- Redis
- Apache Kafka

### Environment Variables
See `.env.example` files in both `packages/backend` and `packages/frontend` directories.

### Testing
```bash
# Backend tests
cd packages/backend
npm test

# Frontend tests
cd packages/frontend
npm test
```

## 📚 Documentation

Comprehensive documentation is available in the `/doc` directory:

- 📘 [Project Purpose & Vision](doc/PROJECT_PURPOSE.md) - What this project is and why
- 🏗️ [Architecture Overview](doc/README.md) - System architecture and components
- 📡 [WebSocket API Reference](doc/websocket.md) - Real-time communication API
- 🔌 [REST API Reference](doc/API_REFERENCE.md) - HTTP endpoints
- 🚀 [Kafka Integration](doc/kafka.md) - Event-driven architecture
- 🔴 [Redis Usage](doc/redis.md) - Caching and presence
- 📦 [Database Schema](doc/postgres.md) - Data models
- 🎯 [NestJS Backend](doc/nest.md) - Backend architecture
- ⚛️ [Next.js Frontend](doc/next.md) - Frontend architecture
 - 🎬🎮📚 [Genres Research](researches/genres/README.md) - Popular genres across books, movies/series, and games
 - 📄 Source file from the issue: [genres/list.md](genres/list.md)

## 🤝 Contributing

This is an **open-source project** and contributions are welcome!

### How to Contribute:

1. **Fork** the repository
2. Create a **feature branch** (`git checkout -b feature/amazing-feature`)
3. **Implement** a feature from the TODO list
4. Add **tests** for new functionality
5. Update **documentation**
6. **Commit** your changes (`git commit -m 'Add amazing feature'`)
7. **Push** to the branch (`git push origin feature/amazing-feature`)
8. Open a **Pull Request**

### Development Guidelines:

- Follow existing code style and conventions
- Write unit and integration tests
- Update documentation for new features
- Keep commits atomic and descriptive
- Add your feature to the completed list in README

### Good First Issues:

Check out issues labeled `good-first-issue` for beginner-friendly tasks!

## 🌟 Show Your Support

If you find this project useful:
- ⭐ **Star** the repository
- 🍴 **Fork** it for your own projects
- 📢 **Share** it with others
- 🐛 **Report** bugs and suggest features
- 💬 **Contribute** code or documentation

## 📄 License

MIT License - feel free to use this project for any purpose, commercial or personal.

See [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the open-source community**

*Ready to scale from MVP to millions of users. Start building today!*
