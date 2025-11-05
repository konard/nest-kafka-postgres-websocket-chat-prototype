import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { KafkaAdapter } from './kafka.adapter';
import {
  KafkaTopic,
  MessageCreatedEvent,
  MessageReadEvent,
  UserOnlineEvent,
  UserOfflineEvent,
  AnalyticsMessageEvent,
  AnalyticsUserActivityEvent,
  AuditLogEvent,
  NotificationSendEvent,
} from './kafka.types';

/**
 * KafkaConsumerService - подписывается на топики и обрабатывает события
 */
@Injectable()
export class KafkaConsumerService implements OnModuleInit {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private readonly handlers = new Map<
    KafkaTopic,
    Array<(event: any) => Promise<void>>
  >();

  constructor(private readonly kafkaAdapter: KafkaAdapter) {}

  async onModuleInit() {
    await this.subscribeToTopics();
  }

  /**
   * Подписка на все необходимые топики
   */
  private async subscribeToTopics(): Promise<void> {
    this.logger.log('Subscribing to Kafka topics...');

    try {
      // Message events
      await this.subscribeToTopic(
        KafkaTopic.MESSAGE_CREATED,
        this.handleMessageCreated.bind(this)
      );
      await this.subscribeToTopic(
        KafkaTopic.MESSAGE_READ,
        this.handleMessageRead.bind(this)
      );

      // User events
      await this.subscribeToTopic(
        KafkaTopic.USER_ONLINE,
        this.handleUserOnline.bind(this)
      );
      await this.subscribeToTopic(
        KafkaTopic.USER_OFFLINE,
        this.handleUserOffline.bind(this)
      );

      // Analytics events
      await this.subscribeToTopic(
        KafkaTopic.ANALYTICS_MESSAGE,
        this.handleAnalyticsMessage.bind(this)
      );
      await this.subscribeToTopic(
        KafkaTopic.ANALYTICS_USER_ACTIVITY,
        this.handleAnalyticsUserActivity.bind(this)
      );

      // Audit events
      await this.subscribeToTopic(
        KafkaTopic.AUDIT_LOG,
        this.handleAuditLog.bind(this)
      );

      // Notification events
      await this.subscribeToTopic(
        KafkaTopic.NOTIFICATION_SEND,
        this.handleNotification.bind(this)
      );

      this.logger.log('Successfully subscribed to all Kafka topics');
    } catch (error) {
      this.logger.error('Failed to subscribe to Kafka topics', error);
    }
  }

  /**
   * Подписка на топик с обработчиком
   */
  private async subscribeToTopic<T>(
    topic: KafkaTopic,
    handler: (event: T) => Promise<void>
  ): Promise<void> {
    // Регистрируем handler
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    this.handlers.get(topic)!.push(handler);

    // Подписываемся на топик
    await this.kafkaAdapter.subscribe(topic, async (event: T) => {
      await this.processEvent(topic, event);
    });

    this.logger.log(`Subscribed to topic: ${topic}`);
  }

  /**
   * Обработка события (вызывает все зарегистрированные handlers)
   */
  private async processEvent<T>(topic: KafkaTopic, event: T): Promise<void> {
    const handlers = this.handlers.get(topic);
    if (!handlers || handlers.length === 0) {
      this.logger.warn(`No handlers registered for topic: ${topic}`);
      return;
    }

    this.logger.debug(`Processing event from topic: ${topic}`, event);

    const promises = handlers.map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Error in handler for topic ${topic}`, error);
      }
    });

    await Promise.all(promises);
  }

  // ============= Event Handlers =============

  /**
   * Обработка создания сообщения
   */
  private async handleMessageCreated(event: MessageCreatedEvent): Promise<void> {
    this.logger.log(`Message created: ${event.data.messageId}`, {
      chatId: event.data.chatId,
      senderId: event.data.senderId,
    });

    // Здесь можно добавить дополнительную обработку:
    // - Отправка уведомлений
    // - Обновление счетчиков
    // - Индексация для поиска
    // - Обработка медиа-контента
  }

  /**
   * Обработка прочтения сообщения
   */
  private async handleMessageRead(event: MessageReadEvent): Promise<void> {
    this.logger.debug(`Message read: ${event.data.messageId} by ${event.data.readBy}`);

    // Можно обновить статистику прочтений
  }

  /**
   * Обработка подключения пользователя
   */
  private async handleUserOnline(event: UserOnlineEvent): Promise<void> {
    this.logger.log(`User online: ${event.data.userId}`, {
      socketId: event.data.socketId,
    });

    // Можно обновить статистику активности
    // Отправить уведомления друзьям
  }

  /**
   * Обработка отключения пользователя
   */
  private async handleUserOffline(event: UserOfflineEvent): Promise<void> {
    this.logger.log(`User offline: ${event.data.userId}`, {
      sessionDuration: event.data.sessionDuration,
    });

    // Сохранить статистику сессии
  }

  /**
   * Обработка аналитики сообщений
   */
  private async handleAnalyticsMessage(event: AnalyticsMessageEvent): Promise<void> {
    this.logger.debug('Analytics message event', {
      messageId: event.data.messageId,
      messageLength: event.data.messageLength,
    });

    // Здесь можно:
    // - Сохранить в аналитическую БД (ClickHouse, TimescaleDB)
    // - Обновить метрики в реальном времени
    // - Отправить в систему мониторинга
  }

  /**
   * Обработка аналитики активности пользователя
   */
  private async handleAnalyticsUserActivity(
    event: AnalyticsUserActivityEvent
  ): Promise<void> {
    this.logger.debug('Analytics user activity event', {
      userId: event.data.userId,
      activityType: event.data.activityType,
    });

    // Аналогично аналитике сообщений
  }

  /**
   * Обработка audit log
   */
  private async handleAuditLog(event: AuditLogEvent): Promise<void> {
    this.logger.log('Audit log event', {
      userId: event.data.userId,
      action: event.data.action,
      resource: event.data.resource,
      result: event.data.result,
    });

    // Сохранение в отдельную БД для audit
    // Отправка алертов при критичных действиях
  }

  /**
   * Обработка уведомлений
   */
  private async handleNotification(event: NotificationSendEvent): Promise<void> {
    this.logger.log('Notification event', {
      userId: event.data.userId,
      type: event.data.type,
      priority: event.data.priority,
    });

    // Отправка push-уведомлений
    // Email уведомления
    // SMS для критичных уведомлений
  }

  // ============= Public API для регистрации дополнительных handlers =============

  /**
   * Позволяет другим сервисам регистрировать свои handlers
   */
  registerHandler<T>(
    topic: KafkaTopic,
    handler: (event: T) => Promise<void>
  ): void {
    if (!this.handlers.has(topic)) {
      this.handlers.set(topic, []);
    }
    this.handlers.get(topic)!.push(handler);
    this.logger.log(`Registered additional handler for topic: ${topic}`);
  }

  /**
   * Удаление handler'а
   */
  unregisterHandler<T>(
    topic: KafkaTopic,
    handler: (event: T) => Promise<void>
  ): void {
    const handlers = this.handlers.get(topic);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        this.logger.log(`Unregistered handler for topic: ${topic}`);
      }
    }
  }
}

