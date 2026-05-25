import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { EventService } from '../../../event/event.service';
import { User } from '../../../user/user.entity';
import { PlanCatalog } from '../entities/plan-catalog.entity';
import { PlanCatalogService } from '../plan-catalog.service';

type AnyFn = (...args: unknown[]) => unknown;

const mockUser = { id: 'user-uuid-1' } as User;

function makeCatalog(overrides: Partial<PlanCatalog> = {}): PlanCatalog {
  return {
    id: 'cat-1',
    name: 'Mensal 2x',
    period: 'monthly',
    durationMonths: 1,
    weeklyFrequency: 2,
    basePrice: '350.00',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeManager(overrides: Record<string, AnyFn> = {}): EntityManager {
  return {
    create: jest.fn((_cls, dto) => ({ ...dto })),
    save: jest.fn(async (_cls, entity) => ({ id: 'cat-1', createdAt: new Date(), updatedAt: new Date(), ...entity })),
    findOne: jest.fn(),
    ...overrides,
  } as unknown as EntityManager;
}

describe('PlanCatalogService (unit)', () => {
  let service: PlanCatalogService;
  let mockManager: EntityManager;

  const mockRepo = {
    createQueryBuilder: jest.fn(),
    findOneBy: jest.fn(),
  };
  const mockDataSource = { transaction: jest.fn() };
  const mockEventService = { record: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockManager = makeManager();
    mockDataSource.transaction.mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(mockManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanCatalogService,
        { provide: getRepositoryToken(PlanCatalog), useValue: mockRepo },
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: EventService, useValue: mockEventService },
      ],
    }).compile();

    service = module.get(PlanCatalogService);
  });

  describe('create()', () => {
    it('sets isActive=true and computes durationMonths from period', async () => {
      const catalog = makeCatalog();
      (mockManager.create as jest.Mock).mockReturnValue(catalog);
      (mockManager.save as jest.Mock).mockResolvedValue(catalog);

      await service.create(
        { name: 'Mensal 2x', period: 'monthly', weeklyFrequency: 2, basePrice: '350.00' },
        mockUser,
      );

      expect(mockManager.create).toHaveBeenCalledWith(
        PlanCatalog,
        expect.objectContaining({ isActive: true, durationMonths: 1 }),
      );
    });

    it('records a plan_catalog.created event', async () => {
      const catalog = makeCatalog();
      (mockManager.create as jest.Mock).mockReturnValue(catalog);
      (mockManager.save as jest.Mock).mockResolvedValue(catalog);

      await service.create(
        { name: 'Mensal 2x', period: 'monthly', weeklyFrequency: 2, basePrice: '350.00' },
        mockUser,
      );

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'plan_catalog.created', entity: 'plan_catalog', userId: mockUser.id }),
      );
    });
  });

  describe('update()', () => {
    it('updates fields and recalculates durationMonths when period changes', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeCatalog({ period: 'monthly', durationMonths: 1 }));
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: PlanCatalog) => entity);

      await service.update('cat-1', { period: 'quarterly' }, mockUser);

      expect(mockManager.save).toHaveBeenCalledWith(
        PlanCatalog,
        expect.objectContaining({ durationMonths: 3 }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.update('missing', { name: 'x' }, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('records a plan_catalog.updated event', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeCatalog());
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: PlanCatalog) => entity);

      await service.update('cat-1', { name: 'Updated' }, mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'plan_catalog.updated', entity: 'plan_catalog', userId: mockUser.id }),
      );
    });
  });

  describe('archive()', () => {
    it('sets isActive to false', async () => {
      let savedEntity: unknown = null;
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeCatalog({ isActive: true }));
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: PlanCatalog) => {
        savedEntity = entity;
        return entity;
      });

      await service.archive('cat-1', mockUser);

      expect((savedEntity as PlanCatalog).isActive).toBe(false);
    });

    it('throws NotFoundException when not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.archive('missing', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('records a plan_catalog.archived event', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeCatalog());
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: PlanCatalog) => entity);

      await service.archive('cat-1', mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'plan_catalog.archived', entity: 'plan_catalog', userId: mockUser.id }),
      );
    });
  });
});
