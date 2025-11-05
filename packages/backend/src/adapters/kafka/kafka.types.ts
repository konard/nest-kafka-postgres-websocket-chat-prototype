/**
 * Kafka Topics для различных типов событий
 */
export enum KafkaTopic {
  // Message events
  MESSAGE_CREATED = 'message.created',
  MESSAGE_UPDATED = 'message.updated',
  MESSAGE_DELETED = 'message.deleted',
  MESSAGE_PINNED = 'message.pinned',
  MESSAGE_UNPINNED = 'message.unpinned',
  MESSAGE_FORWARDED = 'message.forwarded',
  MESSAGE_READ = 'message.read',
  
  // Chat events
  CHAT_CREATED = 'chat.created',
  CHAT_UPDATED = 'chat.updated',
  CHAT_DELETED = 'chat.deleted',
  USER_JOINED_CHAT = 'user.joined.chat',
  USER_LEFT_CHAT = 'user.left.chat',
  
  // User events
  USER_ONLINE = 'user.online',
  USER_OFFLINE = 'user.offline',
  USER_TYPING = 'user.typing',
  
  // Notification events
  NOTIFICATION_SEND = 'notification.send',
  NOTIFICATION_BATCH = 'notification.batch',
  
  // Analytics events
  ANALYTICS_MESSAGE = 'analytics.message',
  ANALYTICS_USER_ACTIVITY = 'analytics.user.activity',
  ANALYTICS_CHAT_ACTIVITY = 'analytics.chat.activity',
  
  // Audit events
  AUDIT_LOG = 'audit.log',
  
  // System events
  SYSTEM_HEALTH = 'system.health',
}

/**
 * Base event interface
 */
export interface KafkaEvent {
  eventId: string;
  eventType: string;
  timestamp: number;
  version: string;
}

/**
 * Message Events
 */
export interface MessageCreatedEvent extends KafkaEvent {
  eventType: 'message.created';
  data: {
    messageId: string;
    chatId: string;
    senderId: string;
    content: string;
    createdAt: Date;
    metadata?: Record<string, any>;
  };
}

export interface MessageUpdatedEvent extends KafkaEvent {
  eventType: 'message.updated';
  data: {
    messageId: string;
    chatId: string;
    updatedBy: string;
    previousContent?: string;
    newContent: string;
    updatedAt: Date;
  };
}

export interface MessageDeletedEvent extends KafkaEvent {
  eventType: 'message.deleted';
  data: {
    messageId: string;
    chatId: string;
    deletedBy: string;
    deletedAt: Date;
    soft: boolean;
  };
}

export interface MessagePinnedEvent extends KafkaEvent {
  eventType: 'message.pinned';
  data: {
    messageId: string;
    chatId: string;
    pinnedBy: string;
    pinnedAt: Date;
  };
}

export interface MessageUnpinnedEvent extends KafkaEvent {
  eventType: 'message.unpinned';
  data: {
    messageId: string;
    chatId: string;
    unpinnedBy: string;
    unpinnedAt: Date;
  };
}

export interface MessageForwardedEvent extends KafkaEvent {
  eventType: 'message.forwarded';
  data: {
    originalMessageId: string;
    newMessageId: string;
    fromChatId: string;
    toChatId: string;
    forwardedBy: string;
    forwardedAt: Date;
  };
}

export interface MessageReadEvent extends KafkaEvent {
  eventType: 'message.read';
  data: {
    messageId: string;
    chatId: string;
    readBy: string;
    readAt: Date;
  };
}

/**
 * Chat Events
 */
export interface ChatCreatedEvent extends KafkaEvent {
  eventType: 'chat.created';
  data: {
    chatId: string;
    type: 'private' | 'group';
    createdBy: string;
    participants: string[];
    createdAt: Date;
    metadata?: Record<string, any>;
  };
}

export interface ChatUpdatedEvent extends KafkaEvent {
  eventType: 'chat.updated';
  data: {
    chatId: string;
    updatedBy: string;
    changes: Record<string, any>;
    updatedAt: Date;
  };
}

export interface ChatDeletedEvent extends KafkaEvent {
  eventType: 'chat.deleted';
  data: {
    chatId: string;
    deletedBy: string;
    deletedAt: Date;
  };
}

export interface UserJoinedChatEvent extends KafkaEvent {
  eventType: 'user.joined.chat';
  data: {
    chatId: string;
    userId: string;
    addedBy?: string;
    joinedAt: Date;
  };
}

export interface UserLeftChatEvent extends KafkaEvent {
  eventType: 'user.left.chat';
  data: {
    chatId: string;
    userId: string;
    leftAt: Date;
    reason?: 'left' | 'removed' | 'banned';
  };
}

/**
 * User Events
 */
export interface UserOnlineEvent extends KafkaEvent {
  eventType: 'user.online';
  data: {
    userId: string;
    socketId: string;
    connectedAt: Date;
    ip?: string;
    userAgent?: string;
  };
}

export interface UserOfflineEvent extends KafkaEvent {
  eventType: 'user.offline';
  data: {
    userId: string;
    socketId: string;
    disconnectedAt: Date;
    sessionDuration: number;
  };
}

export interface UserTypingEvent extends KafkaEvent {
  eventType: 'user.typing';
  data: {
    userId: string;
    chatId: string;
    isTyping: boolean;
    timestamp: Date;
  };
}

/**
 * Notification Events
 */
export interface NotificationSendEvent extends KafkaEvent {
  eventType: 'notification.send';
  data: {
    userId: string;
    type: 'message' | 'mention' | 'system';
    title: string;
    body: string;
    data?: Record<string, any>;
    priority: 'high' | 'normal' | 'low';
  };
}

export interface NotificationBatchEvent extends KafkaEvent {
  eventType: 'notification.batch';
  data: {
    notifications: Array<{
      userId: string;
      type: string;
      content: any;
    }>;
    batchId: string;
  };
}

/**
 * Analytics Events
 */
export interface AnalyticsMessageEvent extends KafkaEvent {
  eventType: 'analytics.message';
  data: {
    messageId: string;
    chatId: string;
    senderId: string;
    messageLength: number;
    hasMedia: boolean;
    mediaType?: string;
    responseTime?: number;
    timestamp: Date;
  };
}

export interface AnalyticsUserActivityEvent extends KafkaEvent {
  eventType: 'analytics.user.activity';
  data: {
    userId: string;
    activityType: 'login' | 'logout' | 'message_sent' | 'message_read' | 'chat_created';
    chatId?: string;
    metadata?: Record<string, any>;
    timestamp: Date;
  };
}

export interface AnalyticsChatActivityEvent extends KafkaEvent {
  eventType: 'analytics.chat.activity';
  data: {
    chatId: string;
    activityType: 'message' | 'user_joined' | 'user_left' | 'updated';
    userId: string;
    metadata?: Record<string, any>;
    timestamp: Date;
  };
}

/**
 * Audit Events
 */
export interface AuditLogEvent extends KafkaEvent {
  eventType: 'audit.log';
  data: {
    userId: string;
    action: string;
    resource: string;
    resourceId: string;
    result: 'success' | 'failure';
    ip?: string;
    userAgent?: string;
    details?: Record<string, any>;
    timestamp: Date;
  };
}

/**
 * System Events
 */
export interface SystemHealthEvent extends KafkaEvent {
  eventType: 'system.health';
  data: {
    instanceId: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: {
      cpu: number;
      memory: number;
      activeConnections: number;
      messageRate: number;
    };
    timestamp: Date;
  };
}

/**
 * Union type of all events
 */
export type AllKafkaEvents =
  | MessageCreatedEvent
  | MessageUpdatedEvent
  | MessageDeletedEvent
  | MessagePinnedEvent
  | MessageUnpinnedEvent
  | MessageForwardedEvent
  | MessageReadEvent
  | ChatCreatedEvent
  | ChatUpdatedEvent
  | ChatDeletedEvent
  | UserJoinedChatEvent
  | UserLeftChatEvent
  | UserOnlineEvent
  | UserOfflineEvent
  | UserTypingEvent
  | NotificationSendEvent
  | NotificationBatchEvent
  | AnalyticsMessageEvent
  | AnalyticsUserActivityEvent
  | AnalyticsChatActivityEvent
  | AuditLogEvent
  | SystemHealthEvent;

/**
 * Helper to create event ID
 */
export function createEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Helper to create base event
 */
export function createBaseEvent<T extends string>(eventType: T): Omit<KafkaEvent, 'data'> & { eventType: T } {
  return {
    eventId: createEventId(),
    eventType,
    timestamp: Date.now(),
    version: '1.0.0',
  };
}

