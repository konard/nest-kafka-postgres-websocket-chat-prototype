import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { RedisOptions } from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryStrategy?: (times: number) => number | void;
  reconnectOnError?: (err: Error) => boolean | 1 | 2;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private subscriber: Redis;
  private isShuttingDown = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    const config = this.getRedisConfig();

    try {
      // Основной клиент для команд
      this.client = new Redis(config);

      // Отдельный клиент для Pub/Sub
      this.subscriber = new Redis(config);

      this.setupEventHandlers(this.client, 'Client');
      this.setupEventHandlers(this.subscriber, 'Subscriber');

      await this.waitForConnection(this.client);
      await this.waitForConnection(this.subscriber);

      this.logger.log('Redis clients connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  private getRedisConfig(): RedisOptions {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const db = this.configService.get<number>('REDIS_DB', 0);

    return {
      host,
      port,
      password,
      db,
      keyPrefix: 'webchat:',
      retryStrategy: (times: number) => {
        if (this.isShuttingDown) {
          return undefined; // Прекращаем повторные попытки при выключении
        }
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(`Retrying Redis connection (attempt ${times}), delay: ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        if (targetErrors.some((targetError) => err.message.includes(targetError))) {
          this.logger.warn(`Reconnecting due to error: ${err.message}`);
          return true;
        }
        return false;
      },
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      enableOfflineQueue: true,
    };
  }

  private setupEventHandlers(client: Redis, name: string): void {
    client.on('connect', () => {
      this.logger.log(`Redis ${name} connecting...`);
    });

    client.on('ready', () => {
      this.logger.log(`Redis ${name} ready`);
    });

    client.on('error', (error) => {
      this.logger.error(`Redis ${name} error:`, error);
    });

    client.on('close', () => {
      this.logger.warn(`Redis ${name} connection closed`);
    });

    client.on('reconnecting', () => {
      this.logger.log(`Redis ${name} reconnecting...`);
    });

    client.on('end', () => {
      this.logger.log(`Redis ${name} connection ended`);
    });
  }

  private waitForConnection(client: Redis): Promise<void> {
    return new Promise((resolve, reject) => {
      if (client.status === 'ready') {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Redis connection timeout'));
      }, 10000);

      client.once('ready', () => {
        clearTimeout(timeout);
        resolve();
      });

      client.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.quit();
        this.logger.log('Redis client disconnected');
      }
      if (this.subscriber) {
        await this.subscriber.quit();
        this.logger.log('Redis subscriber disconnected');
      }
    } catch (error) {
      this.logger.error('Error during Redis disconnect', error);
    }
  }

  // ============= Основные методы для работы с Redis =============

  getClient(): Redis {
    if (!this.client || this.client.status !== 'ready') {
      throw new Error('Redis client is not ready');
    }
    return this.client;
  }

  getSubscriber(): Redis {
    if (!this.subscriber || this.subscriber.status !== 'ready') {
      throw new Error('Redis subscriber is not ready');
    }
    return this.subscriber;
  }

  // ============= String операции =============

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Error getting key ${key}:`, error);
      throw error;
    }
  }

  async set(
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<'OK'> {
    try {
      if (ttlSeconds) {
        return await this.client.set(key, value, 'EX', ttlSeconds);
      }
      return await this.client.set(key, value);
    } catch (error) {
      this.logger.error(`Error setting key ${key}:`, error);
      throw error;
    }
  }

  async del(key: string): Promise<number> {
    try {
      return await this.client.del(key);
    } catch (error) {
      this.logger.error(`Error deleting key ${key}:`, error);
      throw error;
    }
  }

  async exists(key: string): Promise<number> {
    try {
      return await this.client.exists(key);
    } catch (error) {
      this.logger.error(`Error checking existence of key ${key}:`, error);
      throw error;
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    try {
      return await this.client.expire(key, seconds);
    } catch (error) {
      this.logger.error(`Error setting expiry for key ${key}:`, error);
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Error getting TTL for key ${key}:`, error);
      throw error;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      this.logger.error(`Error incrementing key ${key}:`, error);
      throw error;
    }
  }

  async decr(key: string): Promise<number> {
    try {
      return await this.client.decr(key);
    } catch (error) {
      this.logger.error(`Error decrementing key ${key}:`, error);
      throw error;
    }
  }

  // ============= Hash операции =============

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      this.logger.error(`Error getting hash field ${field} from ${key}:`, error);
      throw error;
    }
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    try {
      return await this.client.hset(key, field, value);
    } catch (error) {
      this.logger.error(`Error setting hash field ${field} in ${key}:`, error);
      throw error;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      this.logger.error(`Error getting all hash fields from ${key}:`, error);
      throw error;
    }
  }

  async hdel(key: string, field: string): Promise<number> {
    try {
      return await this.client.hdel(key, field);
    } catch (error) {
      this.logger.error(`Error deleting hash field ${field} from ${key}:`, error);
      throw error;
    }
  }

  async hexists(key: string, field: string): Promise<number> {
    try {
      return await this.client.hexists(key, field);
    } catch (error) {
      this.logger.error(`Error checking hash field ${field} in ${key}:`, error);
      throw error;
    }
  }

  async hkeys(key: string): Promise<string[]> {
    try {
      return await this.client.hkeys(key);
    } catch (error) {
      this.logger.error(`Error getting hash keys from ${key}:`, error);
      throw error;
    }
  }

  async hvals(key: string): Promise<string[]> {
    try {
      return await this.client.hvals(key);
    } catch (error) {
      this.logger.error(`Error getting hash values from ${key}:`, error);
      throw error;
    }
  }

  async hlen(key: string): Promise<number> {
    try {
      return await this.client.hlen(key);
    } catch (error) {
      this.logger.error(`Error getting hash length of ${key}:`, error);
      throw error;
    }
  }

  // ============= Set операции =============

  async sadd(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.sadd(key, ...members);
    } catch (error) {
      this.logger.error(`Error adding members to set ${key}:`, error);
      throw error;
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    try {
      return await this.client.srem(key, ...members);
    } catch (error) {
      this.logger.error(`Error removing members from set ${key}:`, error);
      throw error;
    }
  }

  async smembers(key: string): Promise<string[]> {
    try {
      return await this.client.smembers(key);
    } catch (error) {
      this.logger.error(`Error getting members of set ${key}:`, error);
      throw error;
    }
  }

  async sismember(key: string, member: string): Promise<number> {
    try {
      return await this.client.sismember(key, member);
    } catch (error) {
      this.logger.error(`Error checking member in set ${key}:`, error);
      throw error;
    }
  }

  async scard(key: string): Promise<number> {
    try {
      return await this.client.scard(key);
    } catch (error) {
      this.logger.error(`Error getting cardinality of set ${key}:`, error);
      throw error;
    }
  }

  // ============= Sorted Set операции =============

  async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      return await this.client.zadd(key, score, member);
    } catch (error) {
      this.logger.error(`Error adding member to sorted set ${key}:`, error);
      throw error;
    }
  }

  async zrem(key: string, member: string): Promise<number> {
    try {
      return await this.client.zrem(key, member);
    } catch (error) {
      this.logger.error(`Error removing member from sorted set ${key}:`, error);
      throw error;
    }
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.zrange(key, start, stop);
    } catch (error) {
      this.logger.error(`Error getting range from sorted set ${key}:`, error);
      throw error;
    }
  }

  async zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<string[]> {
    try {
      return await this.client.zrangebyscore(key, min, max);
    } catch (error) {
      this.logger.error(`Error getting range by score from sorted set ${key}:`, error);
      throw error;
    }
  }

  async zcard(key: string): Promise<number> {
    try {
      return await this.client.zcard(key);
    } catch (error) {
      this.logger.error(`Error getting cardinality of sorted set ${key}:`, error);
      throw error;
    }
  }

  async zscore(key: string, member: string): Promise<string | null> {
    try {
      return await this.client.zscore(key, member);
    } catch (error) {
      this.logger.error(`Error getting score from sorted set ${key}:`, error);
      throw error;
    }
  }

  // ============= List операции =============

  async lpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.client.lpush(key, ...values);
    } catch (error) {
      this.logger.error(`Error left pushing to list ${key}:`, error);
      throw error;
    }
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    try {
      return await this.client.rpush(key, ...values);
    } catch (error) {
      this.logger.error(`Error right pushing to list ${key}:`, error);
      throw error;
    }
  }

  async lpop(key: string): Promise<string | null> {
    try {
      return await this.client.lpop(key);
    } catch (error) {
      this.logger.error(`Error left popping from list ${key}:`, error);
      throw error;
    }
  }

  async rpop(key: string): Promise<string | null> {
    try {
      return await this.client.rpop(key);
    } catch (error) {
      this.logger.error(`Error right popping from list ${key}:`, error);
      throw error;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await this.client.lrange(key, start, stop);
    } catch (error) {
      this.logger.error(`Error getting range from list ${key}:`, error);
      throw error;
    }
  }

  async llen(key: string): Promise<number> {
    try {
      return await this.client.llen(key);
    } catch (error) {
      this.logger.error(`Error getting length of list ${key}:`, error);
      throw error;
    }
  }

  // ============= Pub/Sub операции =============

  async publish(channel: string, message: string): Promise<number> {
    try {
      return await this.client.publish(channel, message);
    } catch (error) {
      this.logger.error(`Error publishing to channel ${channel}:`, error);
      throw error;
    }
  }

  async subscribe(
    channel: string,
    handler: (message: string, channel: string) => void,
  ): Promise<void> {
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on('message', handler);
      this.logger.log(`Subscribed to channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Error subscribing to channel ${channel}:`, error);
      throw error;
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    try {
      await this.subscriber.unsubscribe(channel);
      this.logger.log(`Unsubscribed from channel: ${channel}`);
    } catch (error) {
      this.logger.error(`Error unsubscribing from channel ${channel}:`, error);
      throw error;
    }
  }

  // ============= Утилиты =============

  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Error getting keys with pattern ${pattern}:`, error);
      throw error;
    }
  }

  async flushdb(): Promise<'OK'> {
    try {
      return await this.client.flushdb();
    } catch (error) {
      this.logger.error('Error flushing database:', error);
      throw error;
    }
  }

  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      this.logger.error('Error pinging Redis:', error);
      throw error;
    }
  }

  isReady(): boolean {
    return this.client?.status === 'ready' && this.subscriber?.status === 'ready';
  }
}

