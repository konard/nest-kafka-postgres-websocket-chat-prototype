import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface UserSession {
  userId: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  ip?: string;
  userAgent?: string;
  refreshToken?: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSIONS_PREFIX = 'user:sessions:';
  private readonly TOKEN_BLACKLIST_PREFIX = 'token:blacklist:';
  private readonly SESSION_TTL = 86400; // 24 часа

  constructor(private readonly redisService: RedisService) {}

  // ============= Управление сессиями =============

  async createSession(
    userId: string,
    token: string,
    expiresIn: number,
    metadata?: { ip?: string; userAgent?: string; refreshToken?: string }
  ): Promise<string> {
    try {
      const sessionId = this.generateSessionId();
      const now = Date.now();

      const session: UserSession = {
        userId,
        token,
        createdAt: now,
        expiresAt: now + expiresIn * 1000,
        ...metadata,
      };

      const sessionKey = this.SESSION_PREFIX + sessionId;
      const userSessionsKey = this.USER_SESSIONS_PREFIX + userId;

      // Сохраняем сессию
      await this.redisService.set(
        sessionKey,
        JSON.stringify(session),
        Math.floor(expiresIn)
      );

      // Добавляем сессию в список сессий пользователя
      await this.redisService.sadd(userSessionsKey, sessionId);
      await this.redisService.expire(userSessionsKey, this.SESSION_TTL);

      this.logger.debug(`Created session ${sessionId} for user ${userId}`);
      return sessionId;
    } catch (error) {
      this.logger.error('Error creating session:', error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<UserSession | null> {
    try {
      const sessionKey = this.SESSION_PREFIX + sessionId;
      const data = await this.redisService.get(sessionKey);

      if (!data) {
        return null;
      }

      const session: UserSession = JSON.parse(data);

      // Проверяем, не истекла ли сессия
      if (session.expiresAt < Date.now()) {
        await this.deleteSession(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      this.logger.error(`Error getting session ${sessionId}:`, error);
      return null;
    }
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session !== null;
  }

  async updateSession(sessionId: string, updates: Partial<UserSession>): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const updatedSession = { ...session, ...updates };
      const sessionKey = this.SESSION_PREFIX + sessionId;

      const ttl = await this.redisService.ttl(sessionKey);
      await this.redisService.set(
        sessionKey,
        JSON.stringify(updatedSession),
        ttl > 0 ? ttl : this.SESSION_TTL
      );

      this.logger.debug(`Updated session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error updating session ${sessionId}:`, error);
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return;
      }

      const sessionKey = this.SESSION_PREFIX + sessionId;
      const userSessionsKey = this.USER_SESSIONS_PREFIX + session.userId;

      // Удаляем сессию
      await this.redisService.del(sessionKey);

      // Удаляем из списка сессий пользователя
      await this.redisService.srem(userSessionsKey, sessionId);

      this.logger.debug(`Deleted session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error deleting session ${sessionId}:`, error);
      throw error;
    }
  }

  async refreshSession(sessionId: string, newExpiresIn: number): Promise<void> {
    try {
      const sessionKey = this.SESSION_PREFIX + sessionId;
      const session = await this.getSession(sessionId);

      if (!session) {
        throw new Error('Session not found');
      }

      session.expiresAt = Date.now() + newExpiresIn * 1000;

      await this.redisService.set(
        sessionKey,
        JSON.stringify(session),
        Math.floor(newExpiresIn)
      );

      this.logger.debug(`Refreshed session ${sessionId}`);
    } catch (error) {
      this.logger.error(`Error refreshing session ${sessionId}:`, error);
      throw error;
    }
  }

  // ============= Управление сессиями пользователя =============

  async getUserSessions(userId: string): Promise<UserSession[]> {
    try {
      const userSessionsKey = this.USER_SESSIONS_PREFIX + userId;
      const sessionIds = await this.redisService.smembers(userSessionsKey);

      const sessions: UserSession[] = [];
      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (error) {
      this.logger.error(`Error getting sessions for user ${userId}:`, error);
      return [];
    }
  }

  async getUserSessionsCount(userId: string): Promise<number> {
    try {
      const userSessionsKey = this.USER_SESSIONS_PREFIX + userId;
      return await this.redisService.scard(userSessionsKey);
    } catch (error) {
      this.logger.error(`Error getting session count for user ${userId}:`, error);
      return 0;
    }
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    try {
      const sessions = await this.getUserSessions(userId);

      for (const session of sessions) {
        const sessionKey = this.SESSION_PREFIX + this.getSessionIdFromToken(session.token);
        await this.redisService.del(sessionKey);
      }

      const userSessionsKey = this.USER_SESSIONS_PREFIX + userId;
      await this.redisService.del(userSessionsKey);

      this.logger.log(`Deleted all sessions for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting all sessions for user ${userId}:`, error);
      throw error;
    }
  }

  async deleteOtherUserSessions(userId: string, currentSessionId: string): Promise<void> {
    try {
      const userSessionsKey = this.USER_SESSIONS_PREFIX + userId;
      const sessionIds = await this.redisService.smembers(userSessionsKey);

      for (const sessionId of sessionIds) {
        if (sessionId !== currentSessionId) {
          await this.deleteSession(sessionId);
        }
      }

      this.logger.log(`Deleted other sessions for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error deleting other sessions for user ${userId}:`, error);
      throw error;
    }
  }

  // ============= Blacklist токенов =============

  async blacklistToken(token: string, expiresIn: number): Promise<void> {
    try {
      const blacklistKey = this.TOKEN_BLACKLIST_PREFIX + token;
      await this.redisService.set(
        blacklistKey,
        'true',
        Math.floor(expiresIn)
      );

      this.logger.debug('Token added to blacklist');
    } catch (error) {
      this.logger.error('Error blacklisting token:', error);
      throw error;
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const blacklistKey = this.TOKEN_BLACKLIST_PREFIX + token;
      const exists = await this.redisService.exists(blacklistKey);
      return exists === 1;
    } catch (error) {
      this.logger.error('Error checking token blacklist:', error);
      return false;
    }
  }

  // ============= Утилиты =============

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  private getSessionIdFromToken(token: string): string {
    // В реальном приложении нужно извлекать session ID из JWT токена
    // Для простоты используем хэш токена
    return Buffer.from(token).toString('base64').substring(0, 20);
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      const pattern = this.SESSION_PREFIX + '*';
      const keys = await this.redisService.keys(pattern);

      let cleaned = 0;
      for (const key of keys) {
        const data = await this.redisService.get(key);
        if (data) {
          const session: UserSession = JSON.parse(data);
          if (session.expiresAt < Date.now()) {
            await this.redisService.del(key);
            cleaned++;
          }
        }
      }

      this.logger.log(`Cleaned up ${cleaned} expired sessions`);
    } catch (error) {
      this.logger.error('Error cleaning up expired sessions:', error);
    }
  }

  async clearAllSessions(): Promise<void> {
    try {
      const sessionPattern = this.SESSION_PREFIX + '*';
      const sessionKeys = await this.redisService.keys(sessionPattern);

      for (const key of sessionKeys) {
        await this.redisService.del(key);
      }

      const userSessionsPattern = this.USER_SESSIONS_PREFIX + '*';
      const userSessionsKeys = await this.redisService.keys(userSessionsPattern);

      for (const key of userSessionsKeys) {
        await this.redisService.del(key);
      }

      this.logger.log('Cleared all sessions');
    } catch (error) {
      this.logger.error('Error clearing all sessions:', error);
    }
  }

  // ============= Статистика =============

  async getTotalSessionsCount(): Promise<number> {
    try {
      const pattern = this.SESSION_PREFIX + '*';
      const keys = await this.redisService.keys(pattern);
      return keys.length;
    } catch (error) {
      this.logger.error('Error getting total sessions count:', error);
      return 0;
    }
  }

  async getActiveUsersCount(): Promise<number> {
    try {
      const pattern = this.USER_SESSIONS_PREFIX + '*';
      const keys = await this.redisService.keys(pattern);
      return keys.length;
    } catch (error) {
      this.logger.error('Error getting active users count:', error);
      return 0;
    }
  }
}

