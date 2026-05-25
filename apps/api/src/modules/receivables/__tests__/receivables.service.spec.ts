import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { EventService } from '../../../event/event.service';
import { User } from '../../../user/user.entity';
import { Receivable } from '../entities/receivable.entity';
import { ReceivablesService } from '../receivables.service';

type AnyFn = (...args: unknown[]) => unknown;

const mockUser = { id: 'user-uuid-1' } as User;

function makeReceivable(overrides: Partial<Receivable> = {}): Receivable {
  return {
    id: 'rec-1',
    planId: null,
    source: 'manual',
    description: 'Test',
    amount: '500.00',
    dueDate: '2026-07-15',
    installmentNumber: null,
    installmentTotal: null,
    paymentMethod: null,
    status: 'pending',
    paidAt: null,
    invoiceGenerated: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeManager(overrides: Record<string, AnyFn> = {}): EntityManager {
  return {
    create: jest.fn((_cls, dto) => ({ ...dto })),
    save: jest.fn(async (_cls, entity) => ({ id: 'rec-1', createdAt: new Date(), updatedAt: new Date(), ...entity })),
    findOne: jest.fn(),
    ...overrides,
  } as unknown as EntityManager;
}

describe('ReceivablesService (unit)', () => {
  let service: ReceivablesService;
  let mockManager: EntityManager;

  const mockRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const mockDataSource = { transaction: jest.fn() };
  const mockEventService = { record: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockManager = makeManager();
    mockDataSource.transaction.mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(mockManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceivablesService,
        { provide: getRepositoryToken(Receivable), useValue: mockRepo },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: EventService, useValue: mockEventService },
      ],
    }).compile();

    service = module.get(ReceivablesService);
  });

  describe('findOne()', () => {
    it('returns contract when found', async () => {
      mockRepo.findOne.mockResolvedValue(makeReceivable());
      const result = await service.findOne('rec-1');
      expect(result.id).toBe('rec-1');
    });

    it('throws NotFoundException when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createManual()', () => {
    it('sets source=manual and status=pending', async () => {
      const r = makeReceivable();
      (mockManager.create as jest.Mock).mockReturnValue(r);
      (mockManager.save as jest.Mock).mockResolvedValue(r);

      await service.createManual({ description: 'Test', amount: '500.00', dueDate: '2026-07-15' }, mockUser);

      expect(mockManager.create).toHaveBeenCalledWith(
        Receivable,
        expect.objectContaining({ source: 'manual', status: 'pending', planId: null }),
      );
    });

    it('records a receivable.created event', async () => {
      const r = makeReceivable();
      (mockManager.create as jest.Mock).mockReturnValue(r);
      (mockManager.save as jest.Mock).mockResolvedValue(r);

      await service.createManual({ description: 'Test', amount: '500.00', dueDate: '2026-07-15' }, mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'receivable.created', entity: 'receivable', userId: mockUser.id }),
      );
    });
  });

  describe('update()', () => {
    it('updates only provided fields', async () => {
      const r = makeReceivable();
      (mockManager.findOne as jest.Mock).mockResolvedValue(r);
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Receivable) => entity);

      await service.update('rec-1', { description: 'Changed', amount: '600.00' }, mockUser);

      expect(mockManager.save).toHaveBeenCalledWith(
        Receivable,
        expect.objectContaining({ description: 'Changed', amount: '600.00', dueDate: '2026-07-15' }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.update('missing', { description: 'x' }, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('records a receivable.updated event', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeReceivable());
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Receivable) => entity);

      await service.update('rec-1', { description: 'Changed' }, mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'receivable.updated', entity: 'receivable', userId: mockUser.id }),
      );
    });
  });

  describe('pay()', () => {
    it('marks receivable as paid', async () => {
      const r = makeReceivable({ status: 'pending' });
      (mockManager.findOne as jest.Mock).mockResolvedValue(r);
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Receivable) => entity);

      const result = await service.pay('rec-1', { paidAt: '2026-07-20', paymentMethod: 'pix' }, mockUser);

      expect(result.status).toBe('paid');
      expect(result.paidAt).toBe('2026-07-20');
    });

    it('throws ConflictException when already paid', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeReceivable({ status: 'paid' }));
      await expect(service.pay('rec-1', { paidAt: '2026-07-20', paymentMethod: 'pix' }, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.pay('missing', { paidAt: '2026-07-20', paymentMethod: 'pix' }, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('records a receivable.paid event', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeReceivable());
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Receivable) => entity);

      await service.pay('rec-1', { paidAt: '2026-07-20', paymentMethod: 'pix' }, mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'receivable.paid', entity: 'receivable', userId: mockUser.id }),
      );
    });
  });

  describe('unpay()', () => {
    it('reverts paid receivable to pending', async () => {
      const r = makeReceivable({ status: 'paid', paidAt: '2026-07-20', paymentMethod: 'pix' });
      (mockManager.findOne as jest.Mock).mockResolvedValue(r);
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Receivable) => entity);

      const result = await service.unpay('rec-1', mockUser);

      expect(result.status).toBe('pending');
      expect(result.paidAt).toBeNull();
    });

    it('throws ConflictException when already pending', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeReceivable({ status: 'pending' }));
      await expect(service.unpay('rec-1', mockUser)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.unpay('missing', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('records a receivable.unpaid event', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeReceivable({ status: 'paid', paidAt: '2026-07-20' }));
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Receivable) => entity);

      await service.unpay('rec-1', mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'receivable.unpaid', entity: 'receivable', userId: mockUser.id }),
      );
    });
  });

  describe('markInvoiced()', () => {
    it('sets invoiceGenerated to true', async () => {
      const r = makeReceivable({ invoiceGenerated: false });
      (mockManager.findOne as jest.Mock).mockResolvedValue(r);
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Receivable) => entity);

      const result = await service.markInvoiced('rec-1', mockUser);

      expect(result.invoiceGenerated).toBe(true);
    });

    it('throws ConflictException when already invoiced', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeReceivable({ invoiceGenerated: true }));
      await expect(service.markInvoiced('rec-1', mockUser)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.markInvoiced('missing', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('records a receivable.invoiced event', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeReceivable({ invoiceGenerated: false }));
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Receivable) => entity);

      await service.markInvoiced('rec-1', mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'receivable.invoiced', entity: 'receivable', userId: mockUser.id }),
      );
    });
  });

  describe('unmarkInvoiced()', () => {
    it('sets invoiceGenerated to false', async () => {
      const r = makeReceivable({ invoiceGenerated: true });
      (mockManager.findOne as jest.Mock).mockResolvedValue(r);
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Receivable) => entity);

      const result = await service.unmarkInvoiced('rec-1', mockUser);

      expect(result.invoiceGenerated).toBe(false);
    });

    it('throws ConflictException when not invoiced', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeReceivable({ invoiceGenerated: false }));
      await expect(service.unmarkInvoiced('rec-1', mockUser)).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.unmarkInvoiced('missing', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('records a receivable.uninvoiced event', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeReceivable({ invoiceGenerated: true }));
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: Receivable) => entity);

      await service.unmarkInvoiced('rec-1', mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'receivable.uninvoiced', entity: 'receivable', userId: mockUser.id }),
      );
    });
  });
});
