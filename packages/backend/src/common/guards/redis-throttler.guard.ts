import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RedisThrottlerGuard extends ThrottlerGuard {
  constructor(private readonly redisService: RedisService) {
    super({
      throttlers: [
        {
          name: 'default',
          ttl: 60000, // 60 секунд
          limit: 10, // 10 запросов
        },
      ],
    });
  }

  protected async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
    throttler: { name: string }
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = this.generateKey(context, throttler.name);

    try {
      const current = await this.incrementKey(key, ttl);
      
      if (current > limit) {
        throw new ThrottlerException('Too Many Requests');
      }

      return true;
    } catch (error) {
      if (error instanceof ThrottlerException) {
        throw error;
      }
      // Если Redis недоступен, пропускаем запрос
      return true;
    }
  }

  private async incrementKey(key: string, ttl: number): Promise<number> {
    const value = await this.redisService.incr(key);
    
    if (value === 1) {
      // Устанавливаем TTL только для первого запроса
      await this.redisService.expire(key, Math.floor(ttl / 1000));
    }

    return value;
  }

  protected generateKey(context: ExecutionContext, suffix: string): string {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.ip;
    const route = request.route?.path || request.url;
    
    return `throttle:${suffix}:${userId}:${route}`;
  }
}

