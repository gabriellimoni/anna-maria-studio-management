import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Payable } from '../entities/payable.entity';
import { PayablesService } from '../payables.service';

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

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayablesService,
        { provide: getRepositoryToken(Payable), useValue: mockRepo },
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
      mockRepo.create.mockReturnValue(p);
      mockRepo.save.mockResolvedValue(p);

      await service.createManual({
        description: 'Test',
        amount: '500.00',
        dueDate: '2026-07-15',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'manual', status: 'pending', recurringExpenseId: null }),
      );
    });
  });

  describe('pay()', () => {
    it('marks payable as paid', async () => {
      const p = makePayable({ status: 'pending' });
      mockRepo.findOne.mockResolvedValue(p);
      mockRepo.save.mockImplementation(async (entity: Payable) => entity);

      const result = await service.pay('pay-1', { paidAt: '2026-07-20', paymentMethod: 'pix' });

      expect(result.status).toBe('paid');
      expect(result.paidAt).toBe('2026-07-20');
    });

    it('throws ConflictException when already paid', async () => {
      mockRepo.findOne.mockResolvedValue(makePayable({ status: 'paid' }));
      await expect(service.pay('pay-1', { paidAt: '2026-07-20', paymentMethod: 'pix' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.pay('missing', { paidAt: '2026-07-20', paymentMethod: 'pix' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('unpay()', () => {
    it('reverts paid payable to pending', async () => {
      const p = makePayable({ status: 'paid', paidAt: '2026-07-20', paymentMethod: 'pix' });
      mockRepo.findOne.mockResolvedValue(p);
      mockRepo.save.mockImplementation(async (entity: Payable) => entity);

      const result = await service.unpay('pay-1');

      expect(result.status).toBe('pending');
      expect(result.paidAt).toBeNull();
    });

    it('throws ConflictException when already pending', async () => {
      mockRepo.findOne.mockResolvedValue(makePayable({ status: 'pending' }));
      await expect(service.unpay('pay-1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.unpay('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    it('updates only provided fields', async () => {
      const p = makePayable();
      mockRepo.findOne.mockResolvedValue(p);
      mockRepo.save.mockImplementation(async (entity: Payable) => entity);

      await service.update('pay-1', { description: 'Changed', amount: '600.00' });

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Changed', amount: '600.00', dueDate: '2026-07-15' }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { description: 'x' })).rejects.toThrow(NotFoundException);
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
