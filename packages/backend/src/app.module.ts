import { Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { ChatModule } from './chat/chat.module';
import { SocketModule } from './socket/socket.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { User } from './user/entities/user.entity';
import { Chat } from './chat/entities/chat.entity';
import { Message } from './chat/entities/message.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SocketGateway } from './socket/socket.gateway';
import { KafkaAdapter } from './adapters/kafka/kafka.adapter';
import { RedisService } from './redis/redis.service';
import { RedisThrottlerGuard } from './common/guards/redis-throttler.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ShutdownService } from './common/services/shutdown.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: +configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [User, Chat, Message],
        synchronize: true,
        logging: true,
        ssl: false,
        extra: {
          trustServerCertificate: true
        },
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 60 секунд
        limit: 100, // 100 запросов
      },
      {
        name: 'strict',
        ttl: 60000,
        limit: 10, // Для более строгих эндпоинтов
      },
    ]),
    RedisModule,
    AuthModule,
    UserModule,
    ChatModule,
    SocketModule,
    HealthModule,
  ],
  providers: [
    ShutdownService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RedisThrottlerGuard,
    },
    {
      provide: KafkaAdapter,
      useFactory: (configService: ConfigService) => {
        const isDocker = configService.get('IS_DOCKER', 'false') === 'true';
        return new KafkaAdapter({
          clientId: configService.get('KAFKA_CLIENT_ID') || 'webchat',
          brokers: [configService.get('KAFKA_BROKERS') || (isDocker ? 'kafka:9092' : 'localhost:29092')],
          groupId: configService.get('KAFKA_GROUP_ID') || 'webchat-group'
        });
      },
      inject: [ConfigService],
    },
  ],
})
export class AppModule implements OnApplicationShutdown {
  constructor(
    private readonly dataSource: DataSource,
    private readonly socketGateway: SocketGateway,
    private readonly kafkaAdapter: KafkaAdapter,
    private readonly redisService: RedisService
  ) {}

  async onApplicationShutdown(signal?: string) {
    console.log(`Application shutdown (signal: ${signal})`);
    try {
      // Закрываем сокеты
      await this.socketGateway.onModuleDestroy();
      console.log('Socket connections closed');

      // Закрываем Kafka
      await this.kafkaAdapter.onModuleDestroy();
      console.log('Kafka connections closed');

      // Закрываем Redis
      await this.redisService.onModuleDestroy();
      console.log('Redis connections closed');

      // Закрываем БД
      await this.dataSource.destroy();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}