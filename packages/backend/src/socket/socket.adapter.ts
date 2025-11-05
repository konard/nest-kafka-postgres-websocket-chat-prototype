import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisService } from '../redis/redis.service';

export class SocketAdapter extends IoAdapter {
  private readonly configService: ConfigService;
  private readonly redisService: RedisService;
  private readonly logger = new Logger(SocketAdapter.name);
  private server: any;

  constructor(app: INestApplicationContext) {
    super(app);
    this.configService = app.get(ConfigService);
    this.redisService = app.get(RedisService);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const corsOrigin = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    this.logger.log(`Setting up Socket.IO server with CORS origin: ${corsOrigin}`);

    const serverOptions = {
      ...options,
      cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      allowEIO3: true,
      transports: ['websocket'],
      pingTimeout: 30000,
      pingInterval: 10000,
      connectTimeout: 30000,
      maxHttpBufferSize: 1e6,
      allowUpgrades: true,
      perMessageDeflate: {
        threshold: 2048,
      },
      httpCompression: {
        threshold: 2048,
      },
    };

    this.logger.log('Socket.IO server options:', JSON.stringify(serverOptions, null, 2));
    this.server = super.createIOServer(port, serverOptions);
    
    // Настраиваем Redis Adapter для масштабирования
    this.setupRedisAdapter();
    
    // Добавляем логирование для всех событий сервера
    this.server.on('connection_error', (err: any) => {
      this.logger.error('Socket.IO server connection error:', {
        message: err.message,
        type: err.type,
        description: err.description,
        context: err.context,
        stack: err.stack,
      });
    });

    this.server.on('new_namespace', (namespace: any) => {
      this.logger.log(`New namespace created: ${namespace.name}`);
    });

    this.server.on('connect', (socket: any) => {
      this.logger.log(`Socket connected to server: ${socket.id}`, {
        handshake: socket.handshake,
        rooms: Array.from(socket.rooms || []),
        headers: socket.request?.headers,
      });
    });

    this.server.on('disconnect', (socket: any) => {
      this.logger.log(`Socket disconnected from server: ${socket.id}`, {
        reason: socket.disconnected,
        rooms: Array.from(socket.rooms || []),
      });
    });

    return this.server;
  }

  private setupRedisAdapter(): void {
    try {
      if (!this.redisService.isReady()) {
        this.logger.warn('Redis is not ready, skipping Redis adapter setup');
        return;
      }

      const pubClient = this.redisService.getClient();
      const subClient = this.redisService.getSubscriber();

      const redisAdapter = createAdapter(pubClient, subClient);
      this.server.adapter(redisAdapter);

      this.logger.log('Redis adapter configured for Socket.IO');
    } catch (error) {
      this.logger.error('Failed to setup Redis adapter, continuing without it:', error);
    }
  }

  async dispose() {
    if (this.server) {
      this.logger.log('Starting Socket.IO adapter disposal...');

      try {
        // 1. Отключаем всех клиентов
        const sockets = await this.server.sockets?.sockets;
        if (sockets) {
          for (const [, socket] of sockets) {
            if (!socket.disconnected) {
              socket.disconnect(true);
            }
          }
        }

        // 2. Закрываем сервер
        if (this.server.sockets) {
          await new Promise<void>((resolve) => {
            this.server.close(() => resolve());
          });
        }

        this.logger.log('Socket.IO adapter disposed successfully');
      } catch (error) {
        this.logger.error('Error during Socket.IO adapter disposal:', error);
      } finally {
        this.server = null;
      }
    }
  }
}
