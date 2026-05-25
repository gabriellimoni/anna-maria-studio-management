import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { PayableGeneratorService } from '../../scheduling/services/payable-generator.service';
import { RecurringExpense } from '../entities/recurring-expense.entity';
import { RecurringExpensesService } from '../recurring-expenses.service';
import { EventService } from '../../../event/event.service';
import { User } from '../../../user/user.entity';

type AnyFn = (...args: unknown[]) => unknown;

const mockUser = { id: 'user-uuid-1' } as User;

function makeRule(overrides: Partial<RecurringExpense> = {}): RecurringExpense {
  return {
    id: 'rule-1',
    description: 'Aluguel',
    category: null,
    expectedAmount: '2500.00',
    dueDay: 10,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeManager(overrides: Record<string, AnyFn> = {}): EntityManager {
  return {
    create: jest.fn((_cls, dto) => ({ ...dto })),
    save: jest.fn(async (_cls, entity) => ({ id: 'rule-1', createdAt: new Date(), updatedAt: new Date(), ...entity })),
    findOne: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  } as unknown as EntityManager;
}

describe('RecurringExpensesService (unit)', () => {
  let service: RecurringExpensesService;

  const mockRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  let mockManager: EntityManager;

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockGenerator = {
    generateForMonth: jest.fn(),
  };

  const mockEventService = { record: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockManager = makeManager();
    mockDataSource.transaction.mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(mockManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringExpensesService,
        { provide: getRepositoryToken(RecurringExpense), useValue: mockRepo },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: PayableGeneratorService, useValue: mockGenerator },
        { provide: EventService, useValue: mockEventService },
      ],
    }).compile();

    service = module.get(RecurringExpensesService);
  });

  describe('create()', () => {
    it('creates rule with isActive=true and returns contract', async () => {
      const rule = makeRule();
      (mockManager.create as jest.Mock).mockReturnValue(rule);
      (mockManager.save as jest.Mock).mockResolvedValue(rule);

      const result = await service.create({ description: 'Aluguel', expectedAmount: '2500.00', dueDay: 10 }, mockUser);

      expect(mockManager.create).toHaveBeenCalledWith(RecurringExpense, expect.objectContaining({ isActive: true }));
      expect(result.id).toBe('rule-1');
      expect(result.isActive).toBe(true);
    });

    it('records a recurring_expense.created event', async () => {
      const rule = makeRule();
      (mockManager.create as jest.Mock).mockReturnValue(rule);
      (mockManager.save as jest.Mock).mockResolvedValue(rule);

      await service.create({ description: 'Aluguel', expectedAmount: '2500.00', dueDay: 10 }, mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'recurring_expense.created', entity: 'recurring_expense', userId: mockUser.id }),
      );
    });
  });

  describe('findOne()', () => {
    it('returns contract when found', async () => {
      mockRepo.findOne.mockResolvedValue(makeRule());
      const result = await service.findOne('rule-1');
      expect(result.id).toBe('rule-1');
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update()', () => {
    it('updates only provided fields', async () => {
      const rule = makeRule();
      (mockManager.findOne as jest.Mock).mockResolvedValue(rule);
      (mockManager.save as jest.Mock).mockResolvedValue({ ...rule, description: 'Updated' });

      await service.update('rule-1', { description: 'Updated' }, mockUser);

      expect(mockManager.save).toHaveBeenCalledWith(RecurringExpense, expect.objectContaining({ description: 'Updated' }));
      expect(mockManager.save).toHaveBeenCalledWith(RecurringExpense, expect.objectContaining({ dueDay: 10 }));
    });

    it('throws NotFoundException when not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.update('missing', { description: 'x' }, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('can set isActive=false', async () => {
      const rule = makeRule();
      (mockManager.findOne as jest.Mock).mockResolvedValue(rule);
      (mockManager.save as jest.Mock).mockResolvedValue({ ...rule, isActive: false });

      await service.update('rule-1', { isActive: false }, mockUser);

      expect(mockManager.save).toHaveBeenCalledWith(RecurringExpense, expect.objectContaining({ isActive: false }));
    });
  });

  describe('remove()', () => {
    it('deletes the rule', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeRule());
      (mockManager.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.remove('rule-1', mockUser);

      expect(mockManager.delete).toHaveBeenCalledWith(RecurringExpense, { id: 'rule-1' });
    });

    it('throws NotFoundException when not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.remove('missing', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('records a recurring_expense.deleted event', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeRule());
      (mockManager.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.remove('rule-1', mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'recurring_expense.deleted', entity: 'recurring_expense', userId: mockUser.id }),
      );
    });
  });

  describe('runForMonth()', () => {
    const competence = new Date('2026-07-01T00:00:00Z');

    beforeEach(() => {
      mockDataSource.transaction.mockImplementation(async (cb: (m: unknown) => Promise<void>) => {
        await cb({});
      });
    });

    it('counts created payables', async () => {
      mockRepo.find.mockResolvedValue([makeRule({ id: 'r1' }), makeRule({ id: 'r2' })]);
      mockGenerator.generateForMonth.mockResolvedValue({ created: true });

      const result = await service.runForMonth(competence);

      expect(result.created).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('counts skipped payables when already exists', async () => {
      mockRepo.find.mockResolvedValue([makeRule()]);
      mockGenerator.generateForMonth.mockResolvedValue({ created: false });

      const result = await service.runForMonth(competence);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('collects errors without stopping other rules', async () => {
      mockRepo.find.mockResolvedValue([makeRule({ id: 'r1' }), makeRule({ id: 'r2', description: 'Energia' })]);

      mockDataSource.transaction
        .mockImplementationOnce(() => Promise.reject(new Error('DB error')))
        .mockImplementationOnce(async (cb: (m: unknown) => Promise<void>) => {
          await cb({});
          mockGenerator.generateForMonth.mockResolvedValueOnce({ created: true });
        });

      mockGenerator.generateForMonth.mockResolvedValue({ created: true });

      const result = await service.runForMonth(competence);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].ruleId).toBe('r1');
      expect(result.errors[0].error).toBe('DB error');
      expect(result.created).toBe(1);
    });

    it('returns empty result when no active rules', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await service.runForMonth(competence);

      expect(result.created).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
