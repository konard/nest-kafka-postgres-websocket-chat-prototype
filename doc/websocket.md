# WebSocket подсистема

## Роль в проекте

WebSocket обеспечивает двустороннюю real-time коммуникацию между клиентом и сервером для:
- Мгновенной доставки сообщений всем участникам чата
- Отображения статуса пользователей (онлайн/офлайн)
- Уведомлений о наборе текста
- Подтверждений доставки и прочтения сообщений
- Синхронизации состояния между клиентами

## Серверная реализация (Backend)

### Socket Gateway

**Файл:** `packages/backend/src/socket/socket.gateway.ts:25-400`

Основной класс для управления WebSocket соединениями:

```typescript
@WebSocketGateway({
  cors: {
    credentials: true
  }
})
export class SocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly io: Server;
  private connectedClients: Map<string, ConnectedClient> = new Map();
}
```

### Socket Adapter

**Файл:** `packages/backend/src/socket/socket.adapter.ts`

Кастомный адаптер для интеграции Socket.IO с NestJS:
- Конфигурация CORS
- JWT middleware для аутентификации
- Настройка транспортов и таймаутов

Инициализация в main.ts (`packages/backend/src/main.ts:22`):
```typescript
app.useWebSocketAdapter(new SocketAdapter(app));
```

### Socket Module

**Файл:** `packages/backend/src/socket/socket.module.ts:12-21`

```typescript
@Module({
  imports: [AuthModule, ChatModule, UserModule],
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class SocketModule {}
```

## Жизненный цикл соединения

### Инициализация Gateway

**Файл:** `packages/backend/src/socket/socket.gateway.ts:95-110`

```typescript
afterInit(server: Server) {
  this.logger.log('WebSocket Gateway initialized');

  // Настройка CORS после инициализации
  const corsOrigin = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
  server.engine.on('initial_headers', (headers: any, req: any) => {
    headers['Access-Control-Allow-Credentials'] = true;
  });

  // Запуск очистки мертвых соединений
  this.startCleanupInterval();
}
```

### Подключение клиента

**Файл:** `packages/backend/src/socket/socket.gateway.ts:112-155`

```typescript
async handleConnection(socket: Socket) {
  try {
    // Извлекаем токен из handshake
    const token = socket.handshake.auth.token?.replace('Bearer ', '');

    // Валидируем токен
    const payload = await this.jwtService.verifyAsync(token);

    // Находим пользователя
    const user = await this.authService.findUserById(payload.sub);

    // Сохраняем соединение
    socket.data.userId = user.id;
    socket.data.user = user;

    this.connectedClients.set(socket.id, {
      socket,
      userId: user.id,
      lastActivity: new Date(),
    });

    // Присоединяем к комнатам чатов
    const userChats = await this.chatService.getUserChats(user.id);
    for (const chat of userChats) {
      socket.join(`chat-${chat.id}`);
    }

    // Уведомляем о подключении
    socket.emit('connected', { userId: user.id });
    socket.broadcast.emit('user-online', { userId: user.id });

  } catch (error) {
    socket.emit('error', { message: 'Authentication failed' });
    socket.disconnect();
  }
}
```

### Отключение клиента

**Файл:** `packages/backend/src/socket/socket.gateway.ts:157-175`

```typescript
async handleDisconnect(socket: Socket) {
  const userId = socket.data.userId;

  if (userId) {
    // Удаляем из списка подключенных
    this.connectedClients.delete(socket.id);

    // Проверяем, есть ли другие соединения пользователя
    const hasOtherConnections = Array.from(this.connectedClients.values())
      .some(client => client.userId === userId);

    if (!hasOtherConnections) {
      // Уведомляем об офлайн статусе
      socket.broadcast.emit('user-offline', { userId });
    }
  }

  this.logger.log(`Client disconnected: ${socket.id}`);
}
```

## События WebSocket

### Отправка сообщения

**Файл:** `packages/backend/src/socket/socket.gateway.ts:359-446`

```typescript
@SubscribeMessage('message')
async handleMessage(client: Socket, payload: { chatId: string; content: string }) {
  const requestId = uuidv4();
  const userId = client.data?.user?.id;
  if (!userId) {
    this.logger.error('=== Message handling failed: No user ID ===');
    return;
  }

  this.logger.log(`=== Starting message handling (Request ID: ${requestId}) ===`);

  // Получаем чат и проверяем права
  const chat = await this.chatService.getChat(payload.chatId);

  // Проверяем статус получателя
  const recipientId = chat.participants.find((id: string) => id !== userId);

  // Проверяем состояние комнаты
  const roomName = `chat:${payload.chatId}`;
  const room = this.io.sockets.adapter.rooms.get(roomName);

  // Проверяем все сокеты получателя
  const recipientSockets = Array.from(this.connectedClients.entries())
    .filter(([_, client]) => client.userId === recipientId)
    .map(([socketId]) => ({
      socketId,
      inRoom: room?.has(socketId) || false
    }));

  const isRecipientInChat = recipientSockets.some(socket => socket.inRoom);

  // Определяем начальный статус сообщения
  const initialStatus = isRecipientInChat 
    ? MessageDeliveryStatus.DELIVERED 
    : MessageDeliveryStatus.SENT;

  // Сохраняем сообщение
  const message = await this.chatService.saveMessage({
    id: uuidv4(),
    chatId: payload.chatId,
    senderId: userId,
    content: payload.content,
    status: initialStatus,
    createdAt: new Date()
  });

  // Отправляем сообщение в комнату чата
  this.io.to(roomName).emit('message', message);

  // Отправляем подтверждение отправителю
  client.emit('message:ack', { messageId: message.id });

  return message;
}
```

### Присоединение к чату

**Файл:** `packages/backend/src/socket/socket.gateway.ts:508-597`

```typescript
@SubscribeMessage('chat:join')
async handleChatJoin(client: Socket, payload: { chatId: string }) {
  try {
    const userId = client.data?.user?.id;
    if (!userId) {
      this.logger.error('=== Chat join failed: No user ID ===');
      return;
    }

    const requestId = uuidv4();
    this.logger.log(`=== Starting chat join (Request ID: ${requestId}) ===`);

    // Проверяем существование чата
    const chat = await this.chatService.getChat(payload.chatId);

    if (!chat) {
      throw new Error('Chat not found');
    }

    if (!chat.participants.includes(userId)) {
      throw new Error('User is not a participant of this chat');
    }

    // Присоединяемся к комнате чата
    const roomName = `chat:${payload.chatId}`;
    await client.join(roomName);

    // Получаем непрочитанные сообщения
    const undeliveredMessages = await this.chatService.getUndeliveredMessages(
      userId, 
      payload.chatId
    );
    
    // Обновляем статус сообщений на DELIVERED
    for (const message of undeliveredMessages) {
      await this.chatService.updateMessageStatus(
        message.id, 
        MessageDeliveryStatus.DELIVERED
      );
      
      // Находим сокеты отправителя
      const senderSockets = Array.from(this.connectedClients.entries())
        .filter(([_, client]) => client.userId === message.senderId)
        .map(([socketId]) => socketId);
      
      // Уведомляем отправителя об обновлении статуса
      for (const socketId of senderSockets) {
        this.io.to(socketId).emit('message:status', {
          messageId: message.id,
          status: MessageDeliveryStatus.DELIVERED
        });
      }
    }

    return {
      status: 'ok',
      message: 'Joined chat room successfully'
    };
  } catch (error) {
    this.logger.error('Error in handleChatJoin:', error);
    throw error;
  }
}
```

### Выход из чата

**Файл:** `packages/backend/src/socket/socket.gateway.ts:599-664`

```typescript
@SubscribeMessage('chat:leave')
async handleChatLeave(client: Socket, payload: { chatId: string }): Promise<{ success: boolean }> {
  const requestId = uuidv4();
  const userId = client.data?.user?.id;
  if (!userId) {
    this.logger.error('=== Chat leave failed: No user ID ===');
    return { success: false };
  }

  this.logger.log(`=== Starting chat leave (Request ID: ${requestId}) ===`);

  const roomName = `chat:${payload.chatId}`;
  
  try {
    // Покидаем комнату
    await client.leave(roomName);

    // Проверяем все сокеты этого пользователя
    const userSockets = Array.from(this.connectedClients.entries())
      .filter(([_, socket]) => socket.userId === userId)
      .map(([socketId]) => this.io.sockets.sockets.get(socketId))
      .filter((socket): socket is Socket => socket !== undefined);

    // Отключаем все сокеты пользователя от этой комнаты
    for (const socket of userSockets) {
      await socket.leave(roomName);
    }
  } catch (error) {
    this.logger.error(`Error during room leave:`, error);
    return { success: false };
  }

  return { success: true };
}
```

### Закрепление сообщений (Pin)

**Файл:** `packages/backend/src/socket/socket.gateway.ts:727-753`

```typescript
@SubscribeMessage('message:pin')
async handleMessagePin(client: Socket, payload: { messageId: string }) {
  try {
    const userId = client.data.user.id;
    const pinnedMessage = await this.chatService.pinMessage(payload.messageId, userId);

    // Notify all chat participants
    const chatRoom = `chat:${pinnedMessage.chatId}`;
    this.io.to(chatRoom).emit('message:pinned', pinnedMessage);

    return { status: 'ok', message: pinnedMessage };
  } catch (error) {
    this.logger.error('Error in handleMessagePin:', error);
    return { status: 'error', message: error.message };
  }
}
```

### Открепление сообщений (Unpin)

**Файл:** `packages/backend/src/socket/socket.gateway.ts:755-781`

```typescript
@SubscribeMessage('message:unpin')
async handleMessageUnpin(client: Socket, payload: { messageId: string }) {
  try {
    const userId = client.data.user.id;
    const unpinnedMessage = await this.chatService.unpinMessage(payload.messageId, userId);

    // Notify all chat participants
    const chatRoom = `chat:${unpinnedMessage.chatId}`;
    this.io.to(chatRoom).emit('message:unpinned', unpinnedMessage);

    return { status: 'ok', message: unpinnedMessage };
  } catch (error) {
    this.logger.error('Error in handleMessageUnpin:', error);
    return { status: 'error', message: error.message };
  }
}
```

### Получение закрепленных сообщений

**Файл:** `packages/backend/src/socket/socket.gateway.ts:783-813`

```typescript
@SubscribeMessage('chat:get-pinned')
async handleGetPinnedMessages(client: Socket, payload: { chatId: string }) {
  try {
    const userId = client.data.user.id;

    // Verify user is participant
    const chat = await this.chatService.getChat(payload.chatId);
    if (!chat.participants.includes(userId)) {
      return { status: 'error', message: 'User is not a participant of this chat' };
    }

    const pinnedMessages = await this.chatService.getPinnedMessages(payload.chatId);
    return { status: 'ok', messages: pinnedMessages };
  } catch (error) {
    this.logger.error('Error in handleGetPinnedMessages:', error);
    return { status: 'error', message: error.message };
  }
}
```

### Пересылка сообщений (Forward)

**Файл:** `packages/backend/src/socket/socket.gateway.ts:815-850`

```typescript
@SubscribeMessage('message:forward')
async handleMessageForward(client: Socket, payload: {
  messageId: string;
  toChatId: string;
  additionalContent?: string;
}) {
  try {
    const userId = client.data.user.id;
    const forwardedMessage = await this.chatService.forwardMessage(
      payload.messageId,
      payload.toChatId,
      userId,
      payload.additionalContent
    );

    // Notify the target chat room about the new forwarded message
    const targetChatRoom = `chat:${payload.toChatId}`;
    this.io.to(targetChatRoom).emit('message', forwardedMessage);

    return { status: 'ok', message: forwardedMessage };
  } catch (error) {
    this.logger.error('Error in handleMessageForward:', error);
    return { status: 'error', message: error.message };
  }
}
```

### Пересылка нескольких сообщений

**Файл:** `packages/backend/src/socket/socket.gateway.ts:852-890`

```typescript
@SubscribeMessage('message:forward-multiple')
async handleMultipleMessageForward(client: Socket, payload: {
  messageIds: string[];
  toChatId: string;
}) {
  try {
    const userId = client.data.user.id;
    const forwardedMessages = await this.chatService.forwardMultipleMessages(
      payload.messageIds,
      payload.toChatId,
      userId
    );

    // Notify the target chat room about all forwarded messages
    const targetChatRoom = `chat:${payload.toChatId}`;
    forwardedMessages.forEach(message => {
      this.io.to(targetChatRoom).emit('message', message);
    });

    return { status: 'ok', messages: forwardedMessages };
  } catch (error) {
    this.logger.error('Error in handleMultipleMessageForward:', error);
    return { status: 'error', message: error.message };
  }
}
```

### Отметка сообщения как прочитанного

**Файл:** `packages/backend/src/socket/socket.gateway.ts:666-725`

```typescript
@SubscribeMessage('message:read')
async handleMessageRead(client: Socket, payload: { messageId: string }) {
  try {
    const userId = client.data.user.id;
    const message = await this.chatService.getMessage(payload.messageId);

    if (!message) {
      return { status: 'error', message: 'Message not found' };
    }

    // Проверяем, что пользователь является участником чата
    const chat = await this.chatService.getChat(message.chatId);
    if (!chat.participants.includes(userId)) {
      return { status: 'error', message: 'User is not a participant of this chat' };
    }

    // Обновляем статус сообщения
    await this.chatService.updateMessageStatus(payload.messageId, MessageDeliveryStatus.READ);

    const statusUpdate = {
      messageId: payload.messageId,
      status: MessageDeliveryStatus.READ,
      timestamp: new Date().toISOString()
    };

    // Уведомляем отправителя об обновлении статуса
    this.io.to(`user:${message.senderId}`).emit('message:status', statusUpdate);

    return { status: 'ok' };
  } catch (error) {
    this.logger.error('Error in handleMessageRead:', error);
    return { status: 'error', message: error.message };
  }
}
```

## Клиентская реализация (Frontend)

### SocketService

**Файл:** `packages/frontend/src/app/services/socketService.ts:1-170`

Централизованный сервис для управления WebSocket соединением (Singleton паттерн):

```typescript
class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private connectionTimeout: number = 15000; // 15 секунд на подключение
  private reconnectionAttempts: number = 3;
  private currentAttempt: number = 0;
  private readonly backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

  private setupSocketConnection(): Socket {
    if (this.socket?.connected) {
      console.log('Socket already connected, returning existing socket');
      return this.socket;
    }

    if (this.socket) {
      console.log('Disconnecting existing socket');
      this.socket.disconnect();
      this.socket = null;
    }

    console.log('Creating new socket connection');
    this.socket = io(this.backendUrl, {
      auth: {
        token: this.token ? `Bearer ${this.token}` : null
      },
      transports: ['websocket'],
      timeout: this.connectionTimeout,
      reconnection: true,
      reconnectionAttempts: this.reconnectionAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      autoConnect: true
    });

    // Обработчики событий подключения
    this.socket.on('connect', () => {
      console.log('Socket connected successfully');
      this.currentAttempt = 0;
    });

    this.socket.on('connection:established', (data) => {
      console.log('Connection established with server:', data);
    });

    this.socket.on('connect_error', (error) => {
      // Если пользователь не найден - сессия истекла
      if (error.message === 'User not found') {
        console.log('Session expired, stopping reconnection attempts...');
        
        // Отключаем автоматическое переподключение
        if (this.socket) {
          this.socket.io.opts.reconnection = false;
          this.socket.disconnect();
        }
        
        // Очищаем состояние
        this.socket = null;
        this.token = null;
        this.currentAttempt = 0;
        
        // Перенаправляем на страницу логина
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login?reason=session_expired';
        }
        return;
      }

      this.currentAttempt++;
      
      if (this.currentAttempt >= this.reconnectionAttempts) {
        console.error('Max reconnection attempts reached');
        this.disconnect();
      } else {
        // Пробуем переподключиться с экспоненциальной задержкой
        setTimeout(() => {
          this.socket?.connect();
        }, 1000 * Math.pow(2, this.currentAttempt));
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      
      // Если отключение не было намеренным, пробуем переподключиться
      if (reason === 'io server disconnect' || reason === 'transport close') {
        this.socket?.connect();
      }
    });

    return this.socket;
  }

  public connect(token: string): Socket {
    console.log('Connecting with token');
    this.token = token;
    return this.setupSocketConnection();
  }

  public disconnect(): void {
    console.log('Disconnecting socket');
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.token = null;
    this.currentAttempt = 0;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  public reconnect(): void {
    if (this.token) {
      this.connect(this.token);
    }
  }
}

// Создаем единственный экземпляр сервиса (Singleton)
const socketService = new SocketService();
export default socketService;
```

**Основные методы:**
- `connect(token: string): Socket` - подключение с JWT токеном
- `disconnect(): void` - отключение от сервера
- `getSocket(): Socket | null` - получение socket.io клиента
- `isConnected(): boolean` - проверка статуса подключения
- `reconnect(): void` - переподключение с сохраненным токеном

### useSocket Hook

**Файл:** `packages/frontend/src/app/hooks/useSocket.ts`

React hook для интеграции WebSocket в компоненты:

```typescript
export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketService = SocketService.getInstance();

  useEffect(() => {
    // Подписка на события подключения
    socketService.on('connect', () => setIsConnected(true));
    socketService.on('disconnect', () => setIsConnected(false));

    return () => {
      // Очистка при размонтировании
      socketService.off('connect');
      socketService.off('disconnect');
    };
  }, []);

  return {
    socket: socketService,
    isConnected,
    sendMessage: socketService.sendMessage.bind(socketService),
    on: socketService.on.bind(socketService),
    off: socketService.off.bind(socketService),
  };
}
```

### Использование в компонентах

**Файл:** `packages/frontend/src/app/components/Chat.tsx`

```typescript
function Chat() {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    // Подписка на новые сообщения
    socket.on('new-message', handleNewMessage);
    socket.on('user-typing', handleUserTyping);
    socket.on('message-delivered', handleMessageDelivered);

    return () => {
      socket.off('new-message');
      socket.off('user-typing');
      socket.off('message-delivered');
    };
  }, []);

  const sendMessage = (content: string) => {
    socket.emit('send-message', {
      chatId: currentChatId,
      content
    });
  };
}
```

## Аутентификация и безопасность

### JWT валидация

**Файл:** `packages/backend/src/auth/ws-jwt.guard.ts:11-54`

WebSocket-специфичный guard для JWT:

```typescript
@Injectable()
export class WsJwtGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const token = client.handshake.auth.token?.replace('Bearer ', '');

    if (!token) {
      throw new WsException('Missing authentication token');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);
      client.data.user = await this.authService.findUserById(payload.sub);
      return true;
    } catch {
      throw new WsException('Invalid token');
    }
  }
}
```

### Exception Filters

**Файл:** `packages/backend/src/common/filters/ws-exceptions.filter.ts`

Обработчик исключений для WebSocket:

```typescript
@Catch()
export class WsExceptionsFilter implements WsExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const error = exception instanceof WsException
      ? exception.getError()
      : 'Internal server error';

    client.emit('error', { error });
  }
}
```

## Управление состоянием соединений

### Очистка мертвых соединений

**Файл:** `packages/backend/src/socket/socket.gateway.ts:380-400`

```typescript
private startCleanupInterval() {
  this.cleanupInterval = setInterval(() => {
    const now = new Date();
    const timeout = 60000; // 60 секунд

    for (const [socketId, client] of this.connectedClients) {
      const inactiveTime = now.getTime() - client.lastActivity.getTime();

      if (inactiveTime > timeout) {
        this.logger.log(`Disconnecting inactive client: ${socketId}`);
        client.socket.disconnect();
        this.connectedClients.delete(socketId);
      }
    }
  }, 30000); // Проверка каждые 30 секунд
}
```

### Heartbeat механизм

Socket.IO автоматически управляет heartbeat механизмом через встроенные ping/pong события.
Дополнительная настройка heartbeat происходит на уровне конфигурации сервера:

```typescript
// Backend - настройка в socket.adapter.ts
pingInterval: 25000,  // Интервал между ping (по умолчанию)
pingTimeout: 60000    // Timeout для pong ответа
```

### Очистка неактивных соединений

**Файл:** `packages/backend/src/socket/socket.gateway.ts:892-930`

Периодическая проверка и удаление мертвых соединений:

```typescript
private cleanupDeadConnections() {
  try {
    this.logger.log('=== Running periodic connection cleanup ===');
    
    let cleaned = 0;
    const now = new Date();
    const maxInactiveTime = 5 * 60 * 1000; // 5 минут

    for (const [userId, client] of this.connectedClients.entries()) {
      const isInactive = now.getTime() - client.lastActivity.getTime() > maxInactiveTime;
      if (!client.socket.connected || isInactive) {
        client.socket.disconnect(true);
        this.connectedClients.delete(userId);
        cleaned++;
        this.logger.log(`Cleaned up connection for user ${userId}`);
      }
    }

    this.logger.log(`Cleaned up ${cleaned} dead connections`);
  } catch (error) {
    this.logger.error('Cleanup error:', error);
  }
}

// Запуск очистки каждые 30 секунд
this.cleanupInterval = setInterval(() => this.cleanupDeadConnections(), 30000);
```

## Graceful Shutdown

**Файл:** `packages/backend/src/socket/socket.gateway.ts:45-89`

```typescript
public async closeServer() {
  try {
    // Очищаем интервал очистки
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    if (this.io) {
      // Отключаем все соединения
      const sockets = await this.io.fetchSockets();

      await Promise.all(
        Array.from(sockets).map((socket) => {
          return new Promise<void>((resolve) => {
            socket.disconnect(true);
            resolve();
          });
        })
      );

      // Закрываем сервер
      await new Promise<void>((resolve) => {
        this.io.close(() => resolve());
      });

      // Очищаем список клиентов
      this.connectedClients.clear();
    }
  } catch (error) {
    this.logger.error('Error closing Socket.IO server:', error);
    throw error;
  }
}
```

## Масштабирование

### Redis Adapter (для production)

Для горизонтального масштабирования рекомендуется использовать Redis adapter:

```typescript
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ host: 'localhost', port: 6379 });
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));
```

### Sticky Sessions

При использовании нескольких серверов необходимо настроить sticky sessions в load balancer.

## Мониторинг и метрики

### Активные соединения

**Файл:** `packages/backend/src/socket/socket.gateway.ts:91-93`

```typescript
public getActiveConnections(): number {
  return this.io?.sockets?.sockets?.size || 0;
}
```

### Health Check endpoint

Интеграция с HealthModule для мониторинга WebSocket сервера.

## Тестирование

### Unit тесты Gateway

**Файл:** `packages/backend/src/socket/__tests__/socket.gateway.spec.ts`

```typescript
describe('SocketGateway', () => {
  let gateway: SocketGateway;
  let mockSocket: Socket;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocketGateway,
        // ... mocks
      ],
    }).compile();

    gateway = module.get<SocketGateway>(SocketGateway);
  });

  it('should handle connection', async () => {
    await gateway.handleConnection(mockSocket);
    expect(mockSocket.emit).toHaveBeenCalledWith('connected');
  });
});
```

### E2E тестирование

Использование socket.io-client для тестирования:

```typescript
import { io } from 'socket.io-client';

describe('WebSocket E2E', () => {
  let socket: Socket;

  beforeEach((done) => {
    socket = io('http://localhost:4000', {
      auth: { token: validToken }
    });

    socket.on('connect', done);
  });

  it('should receive messages', (done) => {
    socket.on('new-message', (message) => {
      expect(message).toBeDefined();
      done();
    });

    socket.emit('send-message', { chatId, content });
  });
});
```

## Список всех WebSocket событий

### События от клиента к серверу

| Событие | Payload | Описание |
|---------|---------|----------|
| `message` | `{ chatId, content }` | Отправка нового сообщения |
| `chat:get` | `{ recipientId }` | Получение/создание чата с пользователем |
| `chat:join` | `{ chatId }` | Присоединение к комнате чата |
| `chat:leave` | `{ chatId }` | Выход из комнаты чата |
| `users:list` | - | Получение списка пользователей с online статусами |
| `message:read` | `{ messageId }` | Отметка сообщения как прочитанного |
| `message:pin` | `{ messageId }` | Закрепление сообщения |
| `message:unpin` | `{ messageId }` | Открепление сообщения |
| `chat:get-pinned` | `{ chatId }` | Получение закрепленных сообщений чата |
| `message:forward` | `{ messageId, toChatId, additionalContent? }` | Пересылка сообщения |
| `message:forward-multiple` | `{ messageIds[], toChatId }` | Пересылка нескольких сообщений |

### События от сервера к клиенту

| Событие | Payload | Описание |
|---------|---------|----------|
| `connection:established` | `{ userId }` | Подтверждение подключения |
| `message` | `ChatMessage` | Новое сообщение в чате |
| `message:ack` | `{ messageId }` | Подтверждение отправки сообщения |
| `message:status` | `{ messageId, status }` | Обновление статуса доставки |
| `message:pinned` | `ChatMessage` | Сообщение было закреплено |
| `message:unpinned` | `ChatMessage` | Сообщение было откреплено |
| `users:update` | `{ userId, isOnline }` | Обновление online статуса пользователя |

## Производительность

### Оптимизации

1. **Binary данные**: Использование бинарного формата для больших объемов данных
2. **Compression**: Включение сжатия для уменьшения трафика
3. **Throttling**: Ограничение частоты событий от клиента
4. **Rooms**: Использование комнат для эффективной рассылки сообщений
5. **Selective delivery**: Сообщения отправляются только активным участникам чата

### Настройки транспорта

```typescript
// Предпочтительное использование WebSocket
transports: ['websocket']

// Настройки ping/pong (автоматические в Socket.IO)
pingInterval: 25000,  // 25 секунд
pingTimeout: 60000    // 60 секунд
```

### Масштабируемость

Текущая реализация поддерживает:
- Множественные соединения одного пользователя (разные устройства/вкладки)
- Отслеживание активности пользователя в конкретных чатах
- Умное определение статуса доставки на основе присутствия в комнате
- Автоматическая очистка неактивных соединений