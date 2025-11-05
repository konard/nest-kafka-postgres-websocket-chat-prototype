import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { Message } from './entities/message.entity';

@Injectable()
export class MessageCacheService {
  private readonly logger = new Logger(MessageCacheService.name);
  private readonly MESSAGE_PREFIX = 'message:';
  private readonly CHAT_MESSAGES_PREFIX = 'chat:messages:';
  private readonly RECENT_MESSAGES_PREFIX = 'chat:recent:';
  private readonly PINNED_MESSAGES_PREFIX = 'chat:pinned:';
  private readonly MESSAGE_TTL = 3600; // 1 час
  private readonly RECENT_MESSAGES_LIMIT = 50;

  constructor(private readonly redisService: RedisService) {}

  // ============= Кеширование отдельных сообщений =============

  async cacheMessage(message: Message): Promise<void> {
    try {
      const key = this.MESSAGE_PREFIX + message.id;
      await this.redisService.set(
        key,
        JSON.stringify(message),
        this.MESSAGE_TTL
      );

      // Добавляем в список сообщений чата
      const chatMessagesKey = this.CHAT_MESSAGES_PREFIX + message.chatId;
      await this.redisService.zadd(
        chatMessagesKey,
        message.createdAt.getTime(),
        message.id
      );

      // Добавляем в список последних сообщений чата
      await this.addToRecentMessages(message.chatId, message);

      this.logger.debug(`Cached message ${message.id} for chat ${message.chatId}`);
    } catch (error) {
      this.logger.error(`Error caching message ${message.id}:`, error);
    }
  }

  async getCachedMessage(messageId: string): Promise<Message | null> {
    try {
      const key = this.MESSAGE_PREFIX + messageId;
      const data = await this.redisService.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Error getting cached message ${messageId}:`, error);
      return null;
    }
  }

  async deleteCachedMessage(messageId: string, chatId: string): Promise<void> {
    try {
      const key = this.MESSAGE_PREFIX + messageId;
      await this.redisService.del(key);

      // Удаляем из списка сообщений чата
      const chatMessagesKey = this.CHAT_MESSAGES_PREFIX + chatId;
      await this.redisService.zrem(chatMessagesKey, messageId);

      this.logger.debug(`Deleted cached message ${messageId}`);
    } catch (error) {
      this.logger.error(`Error deleting cached message ${messageId}:`, error);
    }
  }

  async updateCachedMessage(message: Message): Promise<void> {
    try {
      const key = this.MESSAGE_PREFIX + message.id;
      const ttl = await this.redisService.ttl(key);

      await this.redisService.set(
        key,
        JSON.stringify(message),
        ttl > 0 ? ttl : this.MESSAGE_TTL
      );

      this.logger.debug(`Updated cached message ${message.id}`);
    } catch (error) {
      this.logger.error(`Error updating cached message ${message.id}:`, error);
    }
  }

  // ============= Последние сообщения чата =============

  private async addToRecentMessages(chatId: string, message: Message): Promise<void> {
    try {
      const key = this.RECENT_MESSAGES_PREFIX + chatId;
      
      // Добавляем сообщение в начало списка
      await this.redisService.lpush(key, JSON.stringify(message));

      // Обрезаем список до максимального размера
      const length = await this.redisService.llen(key);
      if (length > this.RECENT_MESSAGES_LIMIT) {
        await this.redisService.rpop(key);
      }

      // Устанавливаем TTL
      await this.redisService.expire(key, this.MESSAGE_TTL);
    } catch (error) {
      this.logger.error(`Error adding message to recent list for chat ${chatId}:`, error);
    }
  }

  async getRecentMessages(chatId: string, limit: number = 20): Promise<Message[]> {
    try {
      const key = this.RECENT_MESSAGES_PREFIX + chatId;
      const messages = await this.redisService.lrange(key, 0, limit - 1);

      return messages.map(msg => JSON.parse(msg));
    } catch (error) {
      this.logger.error(`Error getting recent messages for chat ${chatId}:`, error);
      return [];
    }
  }

  async clearRecentMessages(chatId: string): Promise<void> {
    try {
      const key = this.RECENT_MESSAGES_PREFIX + chatId;
      await this.redisService.del(key);

      this.logger.debug(`Cleared recent messages for chat ${chatId}`);
    } catch (error) {
      this.logger.error(`Error clearing recent messages for chat ${chatId}:`, error);
    }
  }

  // ============= Закрепленные сообщения =============

  async cachePinnedMessage(message: Message): Promise<void> {
    try {
      const key = this.PINNED_MESSAGES_PREFIX + message.chatId;
      
      await this.redisService.zadd(
        key,
        message.pinnedAt?.getTime() || Date.now(),
        message.id
      );

      // Кешируем само сообщение
      await this.cacheMessage(message);

      this.logger.debug(`Cached pinned message ${message.id} for chat ${message.chatId}`);
    } catch (error) {
      this.logger.error(`Error caching pinned message ${message.id}:`, error);
    }
  }

  async removePinnedMessage(messageId: string, chatId: string): Promise<void> {
    try {
      const key = this.PINNED_MESSAGES_PREFIX + chatId;
      await this.redisService.zrem(key, messageId);

      this.logger.debug(`Removed pinned message ${messageId} from chat ${chatId}`);
    } catch (error) {
      this.logger.error(`Error removing pinned message ${messageId}:`, error);
    }
  }

  async getPinnedMessages(chatId: string): Promise<string[]> {
    try {
      const key = this.PINNED_MESSAGES_PREFIX + chatId;
      // Получаем ID закрепленных сообщений в порядке закрепления (от новых к старым)
      return await this.redisService.zrange(key, 0, -1);
    } catch (error) {
      this.logger.error(`Error getting pinned messages for chat ${chatId}:`, error);
      return [];
    }
  }

  // ============= Сообщения чата =============

  async getChatMessages(
    chatId: string,
    startTime: number,
    endTime: number
  ): Promise<string[]> {
    try {
      const key = this.CHAT_MESSAGES_PREFIX + chatId;
      return await this.redisService.zrangebyscore(key, startTime, endTime);
    } catch (error) {
      this.logger.error(`Error getting chat messages for ${chatId}:`, error);
      return [];
    }
  }

  async getChatMessagesCount(chatId: string): Promise<number> {
    try {
      const key = this.CHAT_MESSAGES_PREFIX + chatId;
      return await this.redisService.zcard(key);
    } catch (error) {
      this.logger.error(`Error getting message count for chat ${chatId}:`, error);
      return 0;
    }
  }

  async clearChatMessages(chatId: string): Promise<void> {
    try {
      const chatMessagesKey = this.CHAT_MESSAGES_PREFIX + chatId;
      const recentMessagesKey = this.RECENT_MESSAGES_PREFIX + chatId;
      const pinnedMessagesKey = this.PINNED_MESSAGES_PREFIX + chatId;

      await this.redisService.del(chatMessagesKey);
      await this.redisService.del(recentMessagesKey);
      await this.redisService.del(pinnedMessagesKey);

      this.logger.debug(`Cleared all cached messages for chat ${chatId}`);
    } catch (error) {
      this.logger.error(`Error clearing chat messages for ${chatId}:`, error);
    }
  }

  // ============= Массовое кеширование =============

  async cacheMultipleMessages(messages: Message[]): Promise<void> {
    try {
      const promises = messages.map(message => this.cacheMessage(message));
      await Promise.all(promises);

      this.logger.debug(`Cached ${messages.length} messages`);
    } catch (error) {
      this.logger.error('Error caching multiple messages:', error);
    }
  }

  async getCachedMessages(messageIds: string[]): Promise<Map<string, Message>> {
    const messagesMap = new Map<string, Message>();

    try {
      const promises = messageIds.map(async (messageId) => {
        const message = await this.getCachedMessage(messageId);
        if (message) {
          messagesMap.set(messageId, message);
        }
      });

      await Promise.all(promises);
    } catch (error) {
      this.logger.error('Error getting cached messages:', error);
    }

    return messagesMap;
  }

  // ============= Утилиты =============

  async invalidateCache(chatId: string): Promise<void> {
    try {
      await this.clearChatMessages(chatId);
      this.logger.log(`Invalidated cache for chat ${chatId}`);
    } catch (error) {
      this.logger.error(`Error invalidating cache for chat ${chatId}:`, error);
    }
  }

  async warmUpCache(chatId: string, messages: Message[]): Promise<void> {
    try {
      await this.cacheMultipleMessages(messages);
      
      // Добавляем последние сообщения в отдельный список
      const recentMessages = messages.slice(-this.RECENT_MESSAGES_LIMIT);
      const key = this.RECENT_MESSAGES_PREFIX + chatId;
      
      for (const message of recentMessages.reverse()) {
        await this.redisService.rpush(key, JSON.stringify(message));
      }
      
      await this.redisService.expire(key, this.MESSAGE_TTL);

      this.logger.log(`Warmed up cache for chat ${chatId} with ${messages.length} messages`);
    } catch (error) {
      this.logger.error(`Error warming up cache for chat ${chatId}:`, error);
    }
  }

  async getStats(): Promise<{
    totalCachedMessages: number;
    totalChats: number;
  }> {
    try {
      const messagePattern = this.MESSAGE_PREFIX + '*';
      const chatPattern = this.CHAT_MESSAGES_PREFIX + '*';

      const messageKeys = await this.redisService.keys(messagePattern);
      const chatKeys = await this.redisService.keys(chatPattern);

      return {
        totalCachedMessages: messageKeys.length,
        totalChats: chatKeys.length,
      };
    } catch (error) {
      this.logger.error('Error getting cache stats:', error);
      return {
        totalCachedMessages: 0,
        totalChats: 0,
      };
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      const patterns = [
        this.MESSAGE_PREFIX + '*',
        this.CHAT_MESSAGES_PREFIX + '*',
        this.RECENT_MESSAGES_PREFIX + '*',
        this.PINNED_MESSAGES_PREFIX + '*',
      ];

      for (const pattern of patterns) {
        const keys = await this.redisService.keys(pattern);
        for (const key of keys) {
          await this.redisService.del(key);
        }
      }

      this.logger.log('Cleared all message cache');
    } catch (error) {
      this.logger.error('Error clearing all cache:', error);
    }
  }
}

