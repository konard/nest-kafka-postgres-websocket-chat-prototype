import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface UserPresence {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
  socketId?: string;
}

@Injectable()
export class UserPresenceService {
  private readonly logger = new Logger(UserPresenceService.name);
  private readonly PRESENCE_PREFIX = 'user:presence:';
  private readonly ONLINE_USERS_SET = 'users:online';
  private readonly USER_SOCKETS_PREFIX = 'user:sockets:';
  private readonly PRESENCE_TTL = 300; // 5 минут

  constructor(private readonly redisService: RedisService) {}

  // ============= Управление статусом =============

  async setOnline(userId: string, socketId: string): Promise<void> {
    try {
      const presence: UserPresence = {
        userId,
        status: 'online',
        lastSeen: Date.now(),
        socketId,
      };

      const key = this.PRESENCE_PREFIX + userId;
      
      // Сохраняем информацию о присутствии
      await this.redisService.set(key, JSON.stringify(presence), this.PRESENCE_TTL);
      
      // Добавляем в набор онлайн пользователей
      await this.redisService.sadd(this.ONLINE_USERS_SET, userId);
      
      // Добавляем сокет для пользователя
      await this.redisService.sadd(this.USER_SOCKETS_PREFIX + userId, socketId);

      this.logger.debug(`User ${userId} set to online with socket ${socketId}`);
    } catch (error) {
      this.logger.error(`Error setting user ${userId} online:`, error);
      throw error;
    }
  }

  async setOffline(userId: string, socketId: string): Promise<void> {
    try {
      // Удаляем сокет
      await this.redisService.srem(this.USER_SOCKETS_PREFIX + userId, socketId);
      
      // Проверяем, остались ли еще активные сокеты
      const activeSockets = await this.getUserSockets(userId);
      
      if (activeSockets.length === 0) {
        // Если сокетов не осталось, устанавливаем оффлайн
        const presence: UserPresence = {
          userId,
          status: 'offline',
          lastSeen: Date.now(),
        };

        const key = this.PRESENCE_PREFIX + userId;
        await this.redisService.set(key, JSON.stringify(presence), 86400); // храним 24 часа
        
        // Удаляем из набора онлайн пользователей
        await this.redisService.srem(this.ONLINE_USERS_SET, userId);
        
        this.logger.debug(`User ${userId} set to offline`);
      } else {
        this.logger.debug(`User ${userId} still has ${activeSockets.length} active socket(s)`);
      }
    } catch (error) {
      this.logger.error(`Error setting user ${userId} offline:`, error);
      throw error;
    }
  }

  async setAway(userId: string): Promise<void> {
    try {
      const presence: UserPresence = {
        userId,
        status: 'away',
        lastSeen: Date.now(),
      };

      const key = this.PRESENCE_PREFIX + userId;
      await this.redisService.set(key, JSON.stringify(presence), this.PRESENCE_TTL);

      this.logger.debug(`User ${userId} set to away`);
    } catch (error) {
      this.logger.error(`Error setting user ${userId} away:`, error);
      throw error;
    }
  }

  async updateLastSeen(userId: string): Promise<void> {
    try {
      const key = this.PRESENCE_PREFIX + userId;
      const existingData = await this.redisService.get(key);
      
      if (existingData) {
        const presence: UserPresence = JSON.parse(existingData);
        presence.lastSeen = Date.now();
        
        await this.redisService.set(key, JSON.stringify(presence), this.PRESENCE_TTL);
        this.logger.debug(`Updated last seen for user ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Error updating last seen for user ${userId}:`, error);
      throw error;
    }
  }

  // ============= Получение статуса =============

  async getUserPresence(userId: string): Promise<UserPresence | null> {
    try {
      const key = this.PRESENCE_PREFIX + userId;
      const data = await this.redisService.get(key);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Error getting presence for user ${userId}:`, error);
      return null;
    }
  }

  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const isMember = await this.redisService.sismember(this.ONLINE_USERS_SET, userId);
      return isMember === 1;
    } catch (error) {
      this.logger.error(`Error checking online status for user ${userId}:`, error);
      return false;
    }
  }

  async getOnlineUsers(): Promise<string[]> {
    try {
      return await this.redisService.smembers(this.ONLINE_USERS_SET);
    } catch (error) {
      this.logger.error('Error getting online users:', error);
      return [];
    }
  }

  async getOnlineUsersCount(): Promise<number> {
    try {
      return await this.redisService.scard(this.ONLINE_USERS_SET);
    } catch (error) {
      this.logger.error('Error getting online users count:', error);
      return 0;
    }
  }

  async getMultipleUsersPresence(userIds: string[]): Promise<Map<string, UserPresence>> {
    const presenceMap = new Map<string, UserPresence>();

    try {
      const promises = userIds.map(async (userId) => {
        const presence = await this.getUserPresence(userId);
        if (presence) {
          presenceMap.set(userId, presence);
        }
      });

      await Promise.all(promises);
    } catch (error) {
      this.logger.error('Error getting multiple users presence:', error);
    }

    return presenceMap;
  }

  // ============= Управление сокетами =============

  async getUserSockets(userId: string): Promise<string[]> {
    try {
      return await this.redisService.smembers(this.USER_SOCKETS_PREFIX + userId);
    } catch (error) {
      this.logger.error(`Error getting sockets for user ${userId}:`, error);
      return [];
    }
  }

  async getUserBySocketId(socketId: string): Promise<string | null> {
    try {
      // Это менее эффективно, но работает
      // В продакшене можно использовать отдельный hash socketId -> userId
      const pattern = this.USER_SOCKETS_PREFIX + '*';
      const keys = await this.redisService.keys(pattern);

      for (const key of keys) {
        const sockets = await this.redisService.smembers(key);
        if (sockets.includes(socketId)) {
          return key.replace(this.USER_SOCKETS_PREFIX, '');
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Error getting user by socket ${socketId}:`, error);
      return null;
    }
  }

  async cleanupUserSockets(userId: string): Promise<void> {
    try {
      await this.redisService.del(this.USER_SOCKETS_PREFIX + userId);
      this.logger.debug(`Cleaned up sockets for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error cleaning up sockets for user ${userId}:`, error);
    }
  }

  // ============= Утилиты =============

  async cleanupExpiredPresence(): Promise<void> {
    try {
      const onlineUsers = await this.getOnlineUsers();
      const now = Date.now();
      const expiredThreshold = now - (this.PRESENCE_TTL * 1000);

      for (const userId of onlineUsers) {
        const presence = await this.getUserPresence(userId);
        if (presence && presence.lastSeen < expiredThreshold) {
          await this.redisService.srem(this.ONLINE_USERS_SET, userId);
          this.logger.debug(`Removed expired presence for user ${userId}`);
        }
      }
    } catch (error) {
      this.logger.error('Error cleaning up expired presence:', error);
    }
  }

  async clearAllPresence(): Promise<void> {
    try {
      const pattern = this.PRESENCE_PREFIX + '*';
      const keys = await this.redisService.keys(pattern);
      
      for (const key of keys) {
        await this.redisService.del(key);
      }
      
      await this.redisService.del(this.ONLINE_USERS_SET);
      
      // Очищаем все сокеты
      const socketPattern = this.USER_SOCKETS_PREFIX + '*';
      const socketKeys = await this.redisService.keys(socketPattern);
      for (const key of socketKeys) {
        await this.redisService.del(key);
      }

      this.logger.log('Cleared all presence data');
    } catch (error) {
      this.logger.error('Error clearing all presence:', error);
    }
  }
}

