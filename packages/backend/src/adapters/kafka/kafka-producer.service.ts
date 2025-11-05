import { Injectable, Logger } from '@nestjs/common';
import { KafkaAdapter } from './kafka.adapter';
import {
  KafkaTopic,
  AllKafkaEvents,
  MessageCreatedEvent,
  MessageUpdatedEvent,
  MessageDeletedEvent,
  MessagePinnedEvent,
  MessageUnpinnedEvent,
  MessageForwardedEvent,
  MessageReadEvent,
  ChatCreatedEvent,
  UserOnlineEvent,
  UserOfflineEvent,
  NotificationSendEvent,
  AnalyticsMessageEvent,
  AnalyticsUserActivityEvent,
  AuditLogEvent,
  createBaseEvent,
} from './kafka.types';

@Injectable()
export class KafkaProducerService {
  private readonly logger = new Logger(KafkaProducerService.name);

  constructor(private readonly kafkaAdapter: KafkaAdapter) {}

  /**
   * Публикация события в Kafka
   */
  private async publishEvent<T extends AllKafkaEvents>(
    topic: KafkaTopic,
    event: T
  ): Promise<void> {
    try {
      await this.kafkaAdapter.publish(topic, event);
      this.logger.debug(`Event published to ${topic}`, {
        eventId: event.eventId,
        eventType: event.eventType,
      });
    } catch (error) {
      this.logger.error(`Failed to publish event to ${topic}`, error);
      // Не выбрасываем ошибку, чтобы не ломать основной flow
    }
  }

  // ============= Message Events =============

  async publishMessageCreated(data: MessageCreatedEvent['data']): Promise<void> {
    const event: MessageCreatedEvent = {
      ...createBaseEvent('message.created'),
      data,
    };
    await this.publishEvent(KafkaTopic.MESSAGE_CREATED, event);
  }

  async publishMessageUpdated(data: MessageUpdatedEvent['data']): Promise<void> {
    const event: MessageUpdatedEvent = {
      ...createBaseEvent('message.updated'),
      data,
    };
    await this.publishEvent(KafkaTopic.MESSAGE_UPDATED, event);
  }

  async publishMessageDeleted(data: MessageDeletedEvent['data']): Promise<void> {
    const event: MessageDeletedEvent = {
      ...createBaseEvent('message.deleted'),
      data,
    };
    await this.publishEvent(KafkaTopic.MESSAGE_DELETED, event);
  }

  async publishMessagePinned(data: MessagePinnedEvent['data']): Promise<void> {
    const event: MessagePinnedEvent = {
      ...createBaseEvent('message.pinned'),
      data,
    };
    await this.publishEvent(KafkaTopic.MESSAGE_PINNED, event);
  }

  async publishMessageUnpinned(data: MessageUnpinnedEvent['data']): Promise<void> {
    const event: MessageUnpinnedEvent = {
      ...createBaseEvent('message.unpinned'),
      data,
    };
    await this.publishEvent(KafkaTopic.MESSAGE_UNPINNED, event);
  }

  async publishMessageForwarded(data: MessageForwardedEvent['data']): Promise<void> {
    const event: MessageForwardedEvent = {
      ...createBaseEvent('message.forwarded'),
      data,
    };
    await this.publishEvent(KafkaTopic.MESSAGE_FORWARDED, event);
  }

  async publishMessageRead(data: MessageReadEvent['data']): Promise<void> {
    const event: MessageReadEvent = {
      ...createBaseEvent('message.read'),
      data,
    };
    await this.publishEvent(KafkaTopic.MESSAGE_READ, event);
  }

  // ============= Chat Events =============

  async publishChatCreated(data: ChatCreatedEvent['data']): Promise<void> {
    const event: ChatCreatedEvent = {
      ...createBaseEvent('chat.created'),
      data,
    };
    await this.publishEvent(KafkaTopic.CHAT_CREATED, event);
  }

  // ============= User Events =============

  async publishUserOnline(data: UserOnlineEvent['data']): Promise<void> {
    const event: UserOnlineEvent = {
      ...createBaseEvent('user.online'),
      data,
    };
    await this.publishEvent(KafkaTopic.USER_ONLINE, event);
  }

  async publishUserOffline(data: UserOfflineEvent['data']): Promise<void> {
    const event: UserOfflineEvent = {
      ...createBaseEvent('user.offline'),
      data,
    };
    await this.publishEvent(KafkaTopic.USER_OFFLINE, event);
  }

  // ============= Notification Events =============

  async publishNotification(data: NotificationSendEvent['data']): Promise<void> {
    const event: NotificationSendEvent = {
      ...createBaseEvent('notification.send'),
      data,
    };
    await this.publishEvent(KafkaTopic.NOTIFICATION_SEND, event);
  }

  /**
   * Batch notifications для оптимизации
   */
  async publishNotificationBatch(
    notifications: NotificationSendEvent['data'][]
  ): Promise<void> {
    const batchEvent = {
      ...createBaseEvent('notification.batch'),
      data: {
        notifications: notifications.map(n => ({
          userId: n.userId,
          type: n.type,
          content: { title: n.title, body: n.body, data: n.data },
        })),
        batchId: `batch-${Date.now()}`,
      },
    };
    await this.publishEvent(KafkaTopic.NOTIFICATION_BATCH, batchEvent);
  }

  // ============= Analytics Events =============

  async publishAnalyticsMessage(data: AnalyticsMessageEvent['data']): Promise<void> {
    const event: AnalyticsMessageEvent = {
      ...createBaseEvent('analytics.message'),
      data,
    };
    await this.publishEvent(KafkaTopic.ANALYTICS_MESSAGE, event);
  }

  async publishAnalyticsUserActivity(
    data: AnalyticsUserActivityEvent['data']
  ): Promise<void> {
    const event: AnalyticsUserActivityEvent = {
      ...createBaseEvent('analytics.user.activity'),
      data,
    };
    await this.publishEvent(KafkaTopic.ANALYTICS_USER_ACTIVITY, event);
  }

  // ============= Audit Events =============

  async publishAuditLog(data: AuditLogEvent['data']): Promise<void> {
    const event: AuditLogEvent = {
      ...createBaseEvent('audit.log'),
      data,
    };
    await this.publishEvent(KafkaTopic.AUDIT_LOG, event);
  }

  // ============= Batch Operations =============

  /**
   * Публикация множественных событий одной транзакцией (для будущего)
   */
  async publishBatch(events: Array<{ topic: KafkaTopic; event: AllKafkaEvents }>): Promise<void> {
    const promises = events.map(({ topic, event }) => this.publishEvent(topic, event));
    await Promise.all(promises);
  }
}

