# API Reference - WebSocket Events

Краткий справочник по WebSocket событиям для разработчиков фронтенда.

## Подключение

```typescript
import socketService from '@/app/services/socketService';

// Подключение с JWT токеном
const socket = socketService.connect(token);

// Проверка статуса
if (socketService.isConnected()) {
  // Соединение активно
}
```

## События клиент → сервер

### Сообщения

#### Отправка сообщения
```typescript
socket.emit('message', {
  chatId: string,
  content: string
});

// Ответ от сервера
socket.on('message:ack', (data: { messageId: string }) => {
  console.log('Message sent:', data.messageId);
});
```

#### Отметка как прочитанного
```typescript
socket.emit('message:read', {
  messageId: string
});

// Ответ
socket.on('message:status', (data: {
  messageId: string,
  status: 'SENT' | 'DELIVERED' | 'READ',
  timestamp: string
}) => {
  // Обновить UI
});
```

### Чаты

#### Получение/создание чата
```typescript
socket.emit('chat:get', {
  recipientId: string
}, (response: {
  chatId: string,
  messages: ChatMessage[]
}) => {
  // Чат получен
});
```

#### Присоединение к чату
```typescript
socket.emit('chat:join', {
  chatId: string
}, (response: {
  status: 'ok',
  message: string
}) => {
  // Присоединились к комнате
});
```

#### Выход из чата
```typescript
socket.emit('chat:leave', {
  chatId: string
}, (response: {
  success: boolean
}) => {
  // Покинули комнату
});
```

### Пользователи

#### Список пользователей
```typescript
socket.emit('users:list', null, (response: {
  users: Array<{
    id: string,
    name: string,
    email: string,
    isOnline: boolean
  }>
}) => {
  // Список получен
});
```

### Закрепление сообщений

#### Закрепить сообщение
```typescript
socket.emit('message:pin', {
  messageId: string
}, (response: {
  status: 'ok' | 'error',
  message?: ChatMessage | string
}) => {
  // Обработать результат
});
```

#### Открепить сообщение
```typescript
socket.emit('message:unpin', {
  messageId: string
}, (response: {
  status: 'ok' | 'error',
  message?: ChatMessage | string
}) => {
  // Обработать результат
});
```

#### Получить закрепленные сообщения
```typescript
socket.emit('chat:get-pinned', {
  chatId: string
}, (response: {
  status: 'ok' | 'error',
  messages?: ChatMessage[] | string
}) => {
  // Показать закрепленные
});
```

### Пересылка сообщений

#### Переслать сообщение
```typescript
socket.emit('message:forward', {
  messageId: string,
  toChatId: string,
  additionalContent?: string  // Опциональный комментарий
}, (response: {
  status: 'ok' | 'error',
  message?: ChatMessage | string
}) => {
  // Обработать результат
});
```

#### Переслать несколько сообщений
```typescript
socket.emit('message:forward-multiple', {
  messageIds: string[],
  toChatId: string
}, (response: {
  status: 'ok' | 'error',
  messages?: ChatMessage[] | string
}) => {
  // Обработать результат
});
```

## События сервер → клиент

### Подписка на события

#### Новое сообщение
```typescript
socket.on('message', (message: ChatMessage) => {
  // Добавить сообщение в UI
  console.log('New message:', message);
});
```

#### Обновление статуса сообщения
```typescript
socket.on('message:status', (data: {
  messageId: string,
  status: 'SENT' | 'DELIVERED' | 'READ',
  timestamp: string
}) => {
  // Обновить статус в UI
});
```

#### Сообщение закреплено
```typescript
socket.on('message:pinned', (message: ChatMessage) => {
  // Показать уведомление о закреплении
  console.log('Message pinned:', message);
});
```

#### Сообщение откреплено
```typescript
socket.on('message:unpinned', (message: ChatMessage) => {
  // Убрать из закрепленных
  console.log('Message unpinned:', message);
});
```

#### Обновление статуса пользователя
```typescript
socket.on('users:update', (data: {
  userId: string,
  isOnline: boolean
}) => {
  // Обновить индикатор онлайн
});
```

#### Подключение установлено
```typescript
socket.on('connection:established', (data: {
  userId: string
}) => {
  console.log('Connected as:', data.userId);
});
```

## Типы данных

### ChatMessage
```typescript
interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  status: 'SENT' | 'DELIVERED' | 'READ';
  createdAt: Date | string;
  
  // Опциональные поля для закрепления
  isPinned?: boolean;
  pinnedAt?: Date | string | null;
  pinnedBy?: string | null;
  
  // Опциональные поля для пересылки
  isForwarded?: boolean;
  forwardedFromId?: string | null;
  originalSenderId?: string | null;
}
```

### MessageDeliveryStatus
```typescript
enum MessageDeliveryStatus {
  SENT = 'SENT',           // ✓ - отправлено на сервер
  DELIVERED = 'DELIVERED', // ✓✓ - доставлено получателю
  READ = 'READ'            // ✓✓✓ - прочитано получателем
}
```

## Обработка ошибок

### Истечение сессии
```typescript
socket.on('connect_error', (error) => {
  if (error.message === 'User not found') {
    // Сессия истекла, перенаправить на login
    window.location.href = '/login?reason=session_expired';
  }
});
```

### Отключение от сервера
```typescript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  
  if (reason === 'io server disconnect') {
    // Сервер принудительно разорвал соединение
    // Попытаться переподключиться
    socket.connect();
  }
});
```

### Ошибки событий
```typescript
// Обработка ошибок в callback'ах
socket.emit('message:pin', { messageId }, (response) => {
  if (response.status === 'error') {
    console.error('Pin failed:', response.message);
    // Показать уведомление пользователю
  }
});
```

## Рекомендации по использованию

### 1. Подписка на события
Подписывайтесь на события **после** подключения:
```typescript
const socket = socketService.connect(token);

socket.on('connect', () => {
  // Теперь можно подписываться на события
  socket.on('message', handleNewMessage);
  socket.on('users:update', handleUserStatus);
});
```

### 2. Отписка от событий
Не забывайте отписываться при размонтировании компонентов:
```typescript
useEffect(() => {
  const socket = socketService.getSocket();
  if (!socket) return;
  
  socket.on('message', handleNewMessage);
  
  return () => {
    socket.off('message', handleNewMessage);
  };
}, []);
```

### 3. Присоединение к чатам
Присоединяйтесь к чату перед его открытием:
```typescript
// 1. Присоединиться к комнате
socket.emit('chat:join', { chatId });

// 2. Теперь будут приходить сообщения
socket.on('message', (msg) => {
  if (msg.chatId === chatId) {
    // Обработать сообщение
  }
});

// 3. При закрытии чата - выйти из комнаты
socket.emit('chat:leave', { chatId });
```

### 4. Статусы доставки
Статусы обновляются автоматически:
- `SENT` - устанавливается при отправке
- `DELIVERED` - когда получатель присоединяется к чату
- `READ` - когда получатель явно отмечает сообщение

### 5. Множественные соединения
Один пользователь может иметь несколько активных соединений (разные вкладки/устройства).
Все соединения получают события, статус "online" сохраняется пока есть хотя бы одно активное соединение.

## Примеры использования

### Компонент чата
```typescript
const Chat = ({ chatId }: { chatId: string }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;
    
    // Присоединяемся к чату
    socket.emit('chat:join', { chatId });
    
    // Подписываемся на новые сообщения
    const handleMessage = (msg: ChatMessage) => {
      if (msg.chatId === chatId) {
        setMessages(prev => [...prev, msg]);
      }
    };
    
    socket.on('message', handleMessage);
    
    return () => {
      socket.off('message', handleMessage);
      socket.emit('chat:leave', { chatId });
    };
  }, [chatId]);
  
  const sendMessage = (content: string) => {
    const socket = socketService.getSocket();
    if (!socket) return;
    
    socket.emit('message', { chatId, content });
  };
  
  return (
    <div>
      {messages.map(msg => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <input onSubmit={(e) => sendMessage(e.target.value)} />
    </div>
  );
};
```

### Список пользователей с online статусом
```typescript
const UsersList = () => {
  const [users, setUsers] = useState<User[]>([]);
  
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;
    
    // Загружаем список
    socket.emit('users:list', null, (response) => {
      setUsers(response.users);
    });
    
    // Слушаем обновления
    const handleUpdate = ({ userId, isOnline }) => {
      setUsers(prev => prev.map(u => 
        u.id === userId ? { ...u, isOnline } : u
      ));
    };
    
    socket.on('users:update', handleUpdate);
    
    return () => {
      socket.off('users:update', handleUpdate);
    };
  }, []);
  
  return (
    <div>
      {users.map(user => (
        <div key={user.id}>
          {user.name}
          {user.isOnline && <span>🟢</span>}
        </div>
      ))}
    </div>
  );
};
```

