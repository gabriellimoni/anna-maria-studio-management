import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { EventService } from '../../../event/event.service';
import { User } from '../../../user/user.entity';
import { CapacityCheckerService } from '../../scheduling/services/capacity-checker.service';
import { Session } from '../../sessions/entities/session.entity';
import { DropInClass } from '../entities/drop-in-class.entity';
import { DropInsService } from '../drop-ins.service';

type AnyFn = (...args: unknown[]) => unknown;

const mockUser = { id: 'user-uuid-1' } as User;

function makeDropIn(overrides: Partial<DropInClass> = {}): DropInClass {
  return {
    id: 'di-1',
    sessionId: 'session-1',
    studentId: null,
    prospectName: 'Visitante',
    receivableId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeManager(overrides: Record<string, AnyFn> = {}): EntityManager {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  } as unknown as EntityManager;
}

function makeRawQb(rows: object[] = []) {
  const qb: Record<string, jest.Mock> = {
    select: jest.fn(),
    addSelect: jest.fn(),
    from: jest.fn(),
    innerJoin: jest.fn(),
    leftJoin: jest.fn(),
    orderBy: jest.fn(),
    andWhere: jest.fn(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
  Object.keys(qb).forEach((k) => {
    if (k !== 'getRawMany') qb[k].mockReturnThis();
  });
  return qb;
}

const rawDropInRow = {
  id: 'di-1',
  session_id: 'session-1',
  student_id: null,
  prospect_name: 'Visitante',
  receivable_id: null,
  scheduled_at: new Date('2026-06-01T09:00:00Z'),
  session_status: 'scheduled',
  student_name: null,
  charge_status: null,
};

describe('DropInsService (unit)', () => {
  let service: DropInsService;
  let mockManager: EntityManager;

  const mockCapacityChecker = {
    countSlot: jest.fn().mockResolvedValue({ isOverCapacity: false, occupied: 1 }),
  };
  const mockEventService = { record: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn(),
    createQueryBuilder: jest.fn(),
    getRepository: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockManager = makeManager();
    mockDataSource.transaction.mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(mockManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DropInsService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: CapacityCheckerService, useValue: mockCapacityChecker },
        { provide: EventService, useValue: mockEventService },
      ],
    }).compile();

    service = module.get(DropInsService);
  });

  describe('create()', () => {
    it('throws UnprocessableEntityException when both studentId and prospectName are provided', async () => {
      await expect(
        service.create({ scheduledAt: '2026-06-01T09:00:00Z', studentId: 'stu-1', prospectName: 'Visitante' }, mockUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when neither studentId nor prospectName is provided', async () => {
      await expect(
        service.create({ scheduledAt: '2026-06-01T09:00:00Z' }, mockUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws NotFoundException when student is not found or inactive', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create({ scheduledAt: '2026-06-01T09:00:00Z', studentId: 'stu-missing' }, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('records a drop_in.created event for prospect', async () => {
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: object) => {
        if (_cls === Session) return { id: 'session-1', ...entity };
        if (_cls === DropInClass) return { id: 'di-1', ...entity };
        return { id: 'generic-1', ...entity };
      });
      mockDataSource.createQueryBuilder.mockReturnValue(makeRawQb([rawDropInRow]));

      await service.create({ scheduledAt: '2026-06-01T09:00:00Z', prospectName: 'Visitante' }, mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'drop_in.created', entity: 'drop_in', userId: mockUser.id }),
      );
    });

    it('includes overCapacity warning in response when slot is over capacity', async () => {
      mockCapacityChecker.countSlot.mockResolvedValue({ isOverCapacity: true, occupied: 5 });
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: object) => {
        if (_cls === Session) return { id: 'session-1', ...entity };
        if (_cls === DropInClass) return { id: 'di-1', ...entity };
        return { id: 'generic-1', ...entity };
      });

      const result = await service.create({ scheduledAt: '2026-06-01T09:00:00Z', prospectName: 'Visitante' }, mockUser);

      expect(result.warnings).toEqual({ overCapacity: true, occupied: 5 });
    });
  });

  describe('update()', () => {
    it('throws NotFoundException when drop-in not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.update('missing', { prospectName: 'Nova' }, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('updates prospectName and records drop_in.updated event', async () => {
      (mockManager.findOne as jest.Mock).mockImplementation(async (cls: unknown) => {
        if (cls === DropInClass) return makeDropIn();
        if (cls === Session) return { id: 'session-1', notes: null };
        return null;
      });
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: object) => entity);
      mockDataSource.createQueryBuilder.mockReturnValue(makeRawQb([rawDropInRow]));

      await service.update('di-1', { prospectName: 'Nova' }, mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'drop_in.updated', entity: 'drop_in', userId: mockUser.id }),
      );
    });
  });

  describe('remove()', () => {
    it('throws NotFoundException when drop-in not found', async () => {
      mockDataSource.getRepository.mockReturnValue({ findOneBy: jest.fn().mockResolvedValue(null) });

      await expect(service.remove('missing', mockUser)).rejects.toThrow(NotFoundException);
    });

    it('cancels the associated session and records drop_in.deleted event', async () => {
      const dropIn = makeDropIn();
      mockDataSource.getRepository.mockReturnValue({ findOneBy: jest.fn().mockResolvedValue(dropIn) });
      (mockManager.findOne as jest.Mock).mockImplementation(async (cls: unknown) => {
        if (cls === Session) return { id: 'session-1', status: 'scheduled' };
        return null;
      });
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: object) => entity);
      (mockManager.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      await service.remove('di-1', mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'drop_in.deleted', entity: 'drop_in', userId: mockUser.id }),
      );
    });

    it('returns pendingReceivableId when receivable is pending', async () => {
      const dropIn = makeDropIn({ receivableId: 'rec-1' });
      mockDataSource.getRepository.mockReturnValue({ findOneBy: jest.fn().mockResolvedValue(dropIn) });
      (mockManager.findOne as jest.Mock).mockImplementation(async (_cls: unknown, opts: { where: { id: string } }) => {
        if (opts.where.id === 'session-1') return { id: 'session-1', status: 'scheduled' };
        if (opts.where.id === 'rec-1') return { id: 'rec-1', status: 'pending' };
        return null;
      });
      (mockManager.save as jest.Mock).mockImplementation(async (_cls: unknown, entity: object) => entity);
      (mockManager.delete as jest.Mock).mockResolvedValue({ affected: 1 });

      const result = await service.remove('di-1', mockUser);

      expect(result.pendingReceivableId).toBe('rec-1');
    });
  });
});
