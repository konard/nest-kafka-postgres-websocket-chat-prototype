import { Module, Global } from '@nestjs/common';
import { KafkaAdapter } from './kafka.adapter';
import { KafkaProducerService } from './kafka-producer.service';
import { KafkaConsumerService } from './kafka-consumer.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: KafkaAdapter,
      useFactory: (configService: ConfigService) => {
        const isDocker = configService.get('IS_DOCKER', 'false') === 'true';
        return new KafkaAdapter({
          clientId: configService.get('KAFKA_CLIENT_ID', 'webchat'),
          brokers: [configService.get('KAFKA_BROKERS', isDocker ? 'kafka:9092' : 'localhost:29092')],
          groupId: configService.get('KAFKA_GROUP_ID', 'webchat-group'),
        });
      },
      inject: [ConfigService],
    },
    KafkaProducerService,
    KafkaConsumerService,
  ],
  exports: [KafkaAdapter, KafkaProducerService, KafkaConsumerService],
})
export class KafkaModule {}
