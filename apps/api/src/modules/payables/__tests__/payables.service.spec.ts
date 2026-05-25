import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Payable } from '../entities/payable.entity';
import { PayablesService } from '../payables.service';
import { EventService } from '../../../event/event.service';
import { User } from '../../../user/user.entity';

type AnyFn = (...args: unknown[]) => unknown;

const mockUser = { id: 'user-uuid-1' } as User;

function makePayable(overrides: Partial<Payable> = {}): Payable {
  return {
    id: 'pay-1',
    recurringExpenseId: null,
    source: 'manual',
    description: 'Test',
    category: null,
    amount: '500.00',
    dueDate: '2026-07-15',
    competenceMonth: null,
    status: 'pending',
    paidAt: null,
    paymentMethod: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeManager(overrides: Record<string, AnyFn> = {}): EntityManager {
  return {
    create: jest.fn((_cls, dto) => ({ ...dto })),
    save: jest.fn(async (_cls, entity) => ({ id: 'pay-1', createdAt: new Date(), updatedAt: new Date(), ...entity })),
    findOne: jest.fn(),
    ...overrides,
  } as unknown as EntityManager;
}

describe('PayablesService (unit)', () => {
  let service: PayablesService;

  const mockQb = {
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getRawOne: jest.fn(),
    getMany: jest.fn(),
  };

  const mockRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQb),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  let mockManager: EntityManager;
  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockEventService = { record: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockManager = makeManager();
    mockDataSource.transaction.mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(mockManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayablesService,
        { provide: getRepositoryToken(Payable), useValue: mockRepo },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: EventService, useValue: mockEventService },
      ],
    }).compile();

    service = module.get(PayablesService);
  });

  describe('findOne()', () => {
    it('returns contract when found', async () => {
      mockRepo.findOne.mockResolvedValue(makePayable());
      const result = await service.findOne('pay-1');
      expect(result.id).toBe('pay-1');
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createManual()', () => {
    it('sets source=manual and status=pending', async () => {
      const p = makePayable();
      (mockManager.create as jest.Mock).mockReturnValue(p);
      (mockManager.save as jest.Mock).mockResolvedValue(p);

      await service.createManual({
        description: 'Test',
        amount: '500.00',
        dueDate: '2026-07-15',
      }, mockUser);

      expect(mockManager.create).toHaveBeenCalledWith(
        Payable,
        expect.objectContaining({ source: 'manual', status: 'pending', recurringExpenseId: null }),
      );
    });

    it('records a payable.created event', async () => {
      const p = makePayable();
      (mockManager.create as jest.Mock).mockReturnValue(p);
      (mockManager.save as jest.Mock).mockResolvedValue(p);

      await service.createManual({ description: 'Test', amount: '500.00', dueDate: '2026-07-15' }, mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'payable.created', entity: 'payable', userId: mockUser.id }),
      );
    });
  });

  describe('pay()', () => {
    it('marks payable as paid', async () => {
      const p = makePayable({ status: 'pending' });
      (mockManager.findOne as jest.Mock).mockResolvedValue(p);
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Payable) => entity);

      const result = await service.pay('pay-1', { paidAt: '2026-07-20', paymentMethod: 'pix' }, mockUser);

      expect(result.status).toBe('paid');
      expect(result.paidAt).toBe('2026-07-20');
    });

    it('throws ConflictException when already paid', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makePayable({ status: 'paid' }));
      await expect(service.pay('pay-1', { paidAt: '2026-07-20', paymentMethod: 'pix' }, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.pay('missing', { paidAt: '2026-07-20', paymentMethod: 'pix' }, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unpay()', () => {
    it('reverts paid payable to pending', async () => {
      const p = makePayable({ status: 'paid', paidAt: '2026-07-20', paymentMethod: 'pix' });
      (mockManager.findOne as jest.Mock).mockResolvedValue(p);
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Payable) => entity);

      const result = await service.unpay('pay-1', mockUser);

      expect(result.status).toBe('pending');
      expect(result.paidAt).toBeNull();
    });

    it('throws ConflictException when already pending', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makePayable({ status: 'pending' }));
      await expect(service.unpay('pay-1', mockUser)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.unpay('missing', mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    it('updates only provided fields', async () => {
      const p = makePayable();
      (mockManager.findOne as jest.Mock).mockResolvedValue(p);
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Payable) => entity);

      await service.update('pay-1', { description: 'Changed', amount: '600.00' }, mockUser);

      expect(mockManager.save).toHaveBeenCalledWith(
        Payable,
        expect.objectContaining({ description: 'Changed', amount: '600.00', dueDate: '2026-07-15' }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.update('missing', { description: 'x' }, mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll()', () => {
    function makeQb(overrides: Record<string, unknown> = {}) {
      return {
        orderBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getRawOne: jest.fn().mockResolvedValue({ totalAmount: '0' }),
        getMany: jest.fn().mockResolvedValue([]),
        ...overrides,
      };
    }

    function setupFindAllMocks(rows: Payable[] = [], count = 0, totalAmount = '0') {
      const countQb = makeQb({ getCount: jest.fn().mockResolvedValue(count) });
      const sumQb = makeQb({ getRawOne: jest.fn().mockResolvedValue({ totalAmount }) });
      const dataQb = makeQb({ getMany: jest.fn().mockResolvedValue(rows) });
      mockRepo.createQueryBuilder
        .mockReturnValueOnce(countQb)
        .mockReturnValueOnce(sumQb)
        .mockReturnValueOnce(dataQb);
      return { countQb, sumQb, dataQb };
    }

    it('applies overdue filter', async () => {
      const { countQb } = setupFindAllMocks();

      await service.findAll({ status: 'overdue' });

      expect(countQb.andWhere).toHaveBeenCalledWith("p.status = 'pending'");
      expect(countQb.andWhere).toHaveBeenCalledWith('p.due_date < CURRENT_DATE');
    });

    it('applies status filter', async () => {
      const { countQb } = setupFindAllMocks();

      await service.findAll({ status: 'paid' });

      expect(countQb.andWhere).toHaveBeenCalledWith('p.status = :status', { status: 'paid' });
    });

    it('returns totalAmount in result', async () => {
      setupFindAllMocks([], 0, '1500.00');

      const result = await service.findAll({});

      expect(result.totalAmount).toBe('1500.00');
    });
  });
});
