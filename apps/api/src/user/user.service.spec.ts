import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventService } from '../event/event.service';
import { User } from './user.entity';
import { UserService } from './user.service';

const mockUser = (): User => ({
  id: 'user-1',
  firebaseUid: 'firebase-uid-1',
  name: 'John Doe',
  email: 'john@example.com',
  role: 'user',
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('UserService', () => {
  let service: UserService;
  let repo: jest.Mocked<Repository<User>>;
  let transactionManager: any;
  let dataSource: any;
  let eventService: any;

  beforeEach(async () => {
    transactionManager = {
      create: jest.fn((_entity: any, data: any) => data),
      save: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn((cb: (m: any) => any) => cb(transactionManager)),
    };

    eventService = { record: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            findOneOrFail: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: EventService, useValue: eventService },
      ],
    }).compile();

    service = module.get(UserService);
    repo = module.get(getRepositoryToken(User));
  });

  describe('findOrCreate', () => {
    it('returns existing user without emitting event', async () => {
      const user = mockUser();
      repo.findOne.mockResolvedValue(user);

      const result = await service.findOrCreate('firebase-uid-1', { name: 'X', email: 'x@x.com' });

      expect(result).toBe(user);
      expect(eventService.record).not.toHaveBeenCalled();
    });

    it('creates user and emits user.created event when not found', async () => {
      const user = mockUser();
      repo.findOne.mockResolvedValue(null);
      transactionManager.save.mockResolvedValue(user);

      const result = await service.findOrCreate('firebase-uid-1', { name: 'John Doe', email: 'john@example.com' });

      expect(transactionManager.create).toHaveBeenCalledWith(User, {
        firebaseUid: 'firebase-uid-1',
        name: 'John Doe',
        email: 'john@example.com',
      });
      expect(transactionManager.save).toHaveBeenCalled();
      expect(eventService.record).toHaveBeenCalledWith(
        transactionManager,
        expect.objectContaining({ action: 'user.created', entity: 'user', userId: user.id }),
      );
      expect(result).toBe(user);
    });
  });

  describe('findById', () => {
    it('returns user by id', async () => {
      const user = mockUser();
      repo.findOne.mockResolvedValue(user);

      const result = await service.findById('user-1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(result).toBe(user);
    });

    it('returns null when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      expect(await service.findById('missing')).toBeNull();
    });
  });

  describe('update', () => {
    it('updates user and returns updated entity', async () => {
      const user = { ...mockUser(), name: 'New Name' };
      repo.update.mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
      repo.findOneOrFail.mockResolvedValue(user);

      const result = await service.update('user-1', { name: 'New Name' });

      expect(repo.update).toHaveBeenCalledWith('user-1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });
  });
});
