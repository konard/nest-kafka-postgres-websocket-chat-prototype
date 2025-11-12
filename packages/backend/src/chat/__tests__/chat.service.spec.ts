import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from '../chat.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Chat } from '../entities/chat.entity';
import { Message } from '../entities/message.entity';
import { User } from '../../user/entities/user.entity';
import { MessageDeliveryStatus } from '@webchat/common';

describe('ChatService - Message Pinning and Forwarding', () => {
  let service: ChatService;
  let messageRepository: jest.Mocked<Repository<Message>>;
  let chatRepository: jest.Mocked<Repository<Chat>>;

  const mockMessage = {
    id: 'message-1',
    chatId: 'chat-1',
    senderId: 'user-1',
    content: 'Test message',
    status: MessageDeliveryStatus.SENT,
    isPinned: false,
    pinnedAt: null,
    pinnedBy: null,
    isForwarded: false,
    forwardedFromId: null,
    originalSenderId: null,
    createdAt: new Date(),
  } as unknown as Message;

  const mockChat = {
    id: 'chat-1',
    participants: [
      { id: 'user-1' },
      { id: 'user-2' },
    ],
  } as unknown as Chat;

  const kafkaProducerMock = {
    publishMessagePinned: jest.fn().mockResolvedValue(undefined),
    publishMessageCreated: jest.fn().mockResolvedValue(undefined),
    publishAnalyticsMessage: jest.fn().mockResolvedValue(undefined),
  };

  const messageCacheMock = {
    cacheMessage: jest.fn().mockResolvedValue(undefined),
    cachePinnedMessage: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(Chat), useValue: {
            findOne: jest.fn(), findOneBy: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(), createQueryBuilder: jest.fn(),
          } },
        { provide: getRepositoryToken(Message), useValue: {
            findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn(),
          } },
        { provide: getRepositoryToken(User), useValue: {
            findOneBy: jest.fn(), findOne: jest.fn(),
          } },
        { provide: require('../../adapters/kafka/kafka-producer.service').KafkaProducerService, useValue: kafkaProducerMock },
        { provide: require('../message-cache.service').MessageCacheService, useValue: messageCacheMock },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    messageRepository = module.get(getRepositoryToken(Message));
    chatRepository = module.get(getRepositoryToken(Chat));
  });

  describe('Message Pinning', () => {
    it('pins a message successfully', async () => {
      const pinnedMessage = { ...mockMessage, isPinned: true, pinnedAt: new Date(), pinnedBy: 'user-1' } as unknown as Message;

      jest.spyOn(messageRepository, 'findOne').mockResolvedValue(mockMessage);
      jest.spyOn(chatRepository, 'findOne').mockResolvedValue(mockChat);
      jest.spyOn(messageRepository, 'save').mockResolvedValue(pinnedMessage);

      const result = await service.pinMessage('message-1', 'user-1');

      expect(result.isPinned).toBe(true);
      expect(result.pinnedBy).toBe('user-1');
    });
  });

  describe('Message Forwarding', () => {
    it('forwards a message successfully', async () => {
      const forwardedMessage = {
        ...mockMessage,
        id: 'message-2',
        chatId: 'chat-2',
        isForwarded: true,
        forwardedFromId: 'message-1',
        originalSenderId: 'user-1',
      } as unknown as Message;

      // First findOne for original message, second for original chat, third for target chat
      jest.spyOn(messageRepository, 'findOne').mockResolvedValue(mockMessage);
      jest.spyOn(chatRepository, 'findOne').mockResolvedValueOnce(mockChat).mockResolvedValueOnce({ ...mockChat, id: 'chat-2' } as Chat);
      jest.spyOn(messageRepository, 'create').mockReturnValue(forwardedMessage);
      jest.spyOn(messageRepository, 'save').mockResolvedValue(forwardedMessage);

      const result = await service.forwardMessage('message-1', 'chat-2', 'user-1');

      expect(result.isForwarded).toBe(true);
      expect(result.forwardedFromId).toBe('message-1');
    });
  });
});
