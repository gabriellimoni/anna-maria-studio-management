import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { PayableGeneratorService } from '../../scheduling/services/payable-generator.service';
import { RecurringExpense } from '../entities/recurring-expense.entity';
import { RecurringExpensesService } from '../recurring-expenses.service';

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

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockGenerator = {
    generateForMonth: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringExpensesService,
        { provide: getRepositoryToken(RecurringExpense), useValue: mockRepo },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: PayableGeneratorService, useValue: mockGenerator },
      ],
    }).compile();

    service = module.get(RecurringExpensesService);
  });

  describe('create()', () => {
    it('creates rule with isActive=true and returns contract', async () => {
      const rule = makeRule();
      mockRepo.create.mockReturnValue(rule);
      mockRepo.save.mockResolvedValue(rule);

      const result = await service.create({ description: 'Aluguel', expectedAmount: '2500.00', dueDay: 10 });

      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
      expect(result.id).toBe('rule-1');
      expect(result.isActive).toBe(true);
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
      mockRepo.findOne.mockResolvedValue(rule);
      mockRepo.save.mockResolvedValue({ ...rule, description: 'Updated' });

      await service.update('rule-1', { description: 'Updated' });

      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ description: 'Updated' }));
      // dueDay unchanged
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ dueDay: 10 }));
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { description: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('can set isActive=false', async () => {
      const rule = makeRule();
      mockRepo.findOne.mockResolvedValue(rule);
      mockRepo.save.mockResolvedValue({ ...rule, isActive: false });

      await service.update('rule-1', { isActive: false });

      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });
  });

  describe('remove()', () => {
    it('deletes the rule', async () => {
      mockRepo.findOne.mockResolvedValue(makeRule());
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      await service.remove('rule-1');

      expect(mockRepo.delete).toHaveBeenCalledWith('rule-1');
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('runForMonth()', () => {
    const competence = new Date('2026-07-01T00:00:00Z');

    beforeEach(() => {
      // Simulate dataSource.transaction calling the callback with a mock manager
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

      // First rule's transaction fails
      mockDataSource.transaction
        .mockImplementationOnce(() => Promise.reject(new Error('DB error')))
        .mockImplementationOnce(async (cb: (m: unknown) => Promise<void>) => {
          await cb({});
          mockGenerator.generateForMonth.mockResolvedValueOnce({ created: true });
        });

      // Second transaction calls generator which returns created:true
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
