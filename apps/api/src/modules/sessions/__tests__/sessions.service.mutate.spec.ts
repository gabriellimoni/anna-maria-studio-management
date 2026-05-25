import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { EventService } from '../../../event/event.service';
import { User } from '../../../user/user.entity';
import { Session } from '../entities/session.entity';
import { SessionsService } from '../sessions.service';

type AnyFn = (...args: unknown[]) => unknown;

const mockUser = { id: 'user-uuid-1' } as User;

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1',
    planId: null,
    studentId: 'student-1',
    scheduledAt: new Date('2026-06-01T09:00:00Z'),
    status: 'scheduled',
    origin: 'plan',
    notes: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  } as Session;
}

function makeManager(overrides: Record<string, AnyFn> = {}): EntityManager {
  return {
    findOne: jest.fn(),
    save: jest.fn(async (_cls: unknown, entity: Session) => entity),
    ...overrides,
  } as unknown as EntityManager;
}

function makeRawQb(rows: object[] = []) {
  const qb: Record<string, jest.Mock> = {
    select: jest.fn(),
    addSelect: jest.fn(),
    from: jest.fn(),
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

describe('SessionsService mutate (unit)', () => {
  let service: SessionsService;
  let mockManager: EntityManager;
  const mockEventService = { record: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockManager = makeManager();
    mockDataSource.transaction.mockImplementation(async (cb: (m: EntityManager) => Promise<unknown>) => cb(mockManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: EventService, useValue: mockEventService },
      ],
    }).compile();

    service = module.get(SessionsService);
  });

  describe('updateSession()', () => {
    it('throws NotFoundException when session not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.updateSession('missing', { notes: 'x' }, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('throws UnprocessableEntityException when status is cancelled', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeSession());
      await expect(
        service.updateSession('session-1', { status: 'cancelled' as never }, mockUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('updates notes on session', async () => {
      const session = makeSession();
      (mockManager.findOne as jest.Mock).mockResolvedValue(session);
      mockDataSource.createQueryBuilder.mockReturnValue(
        makeRawQb([{
          id: 'session-1', plan_id: null, student_id: 'student-1',
          scheduled_at: new Date('2026-06-01T09:00:00Z'),
          status: 'scheduled', origin: 'plan', notes: 'updated note',
          created_at: new Date(), updated_at: new Date(), studentName: 'Maria',
        }]),
      );

      await service.updateSession('session-1', { notes: 'updated note' }, mockUser);

      expect(mockManager.save).toHaveBeenCalledWith(Session, expect.objectContaining({ notes: 'updated note' }));
    });

    it('records a session.updated event', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeSession());
      mockDataSource.createQueryBuilder.mockReturnValue(
        makeRawQb([{
          id: 'session-1', plan_id: null, student_id: 'student-1',
          scheduled_at: new Date(), status: 'scheduled', origin: 'plan',
          notes: null, created_at: new Date(), updated_at: new Date(), studentName: 'Maria',
        }]),
      );

      await service.updateSession('session-1', { notes: 'hello' }, mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'session.updated', entity: 'session', userId: mockUser.id }),
      );
    });
  });

  describe('cancelSession()', () => {
    it('throws NotFoundException when session not found', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.cancelSession('missing', {}, mockUser)).rejects.toThrow(NotFoundException);
    });

    it('throws UnprocessableEntityException when already cancelled', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeSession({ status: 'cancelled' }));
      await expect(service.cancelSession('session-1', {}, mockUser)).rejects.toThrow(UnprocessableEntityException);
    });

    it('sets status to cancelled and appends reason to notes', async () => {
      const session = makeSession({ notes: null });
      (mockManager.findOne as jest.Mock).mockResolvedValue(session);
      mockDataSource.createQueryBuilder.mockReturnValue(
        makeRawQb([{
          id: 'session-1', plan_id: null, student_id: 'student-1',
          scheduled_at: new Date(), status: 'cancelled', origin: 'plan',
          notes: '[Cancelamento] Faltou', created_at: new Date(), updated_at: new Date(), studentName: 'Maria',
        }]),
      );

      await service.cancelSession('session-1', { reason: 'Faltou' }, mockUser);

      expect(mockManager.save).toHaveBeenCalledWith(
        Session,
        expect.objectContaining({ status: 'cancelled', notes: '[Cancelamento] Faltou' }),
      );
    });

    it('records a session.cancelled event', async () => {
      (mockManager.findOne as jest.Mock).mockResolvedValue(makeSession());
      mockDataSource.createQueryBuilder.mockReturnValue(
        makeRawQb([{
          id: 'session-1', plan_id: null, student_id: 'student-1',
          scheduled_at: new Date(), status: 'cancelled', origin: 'plan',
          notes: null, created_at: new Date(), updated_at: new Date(), studentName: 'Maria',
        }]),
      );

      await service.cancelSession('session-1', { reason: 'sick' }, mockUser);

      expect(mockEventService.record).toHaveBeenCalledWith(
        mockManager,
        expect.objectContaining({ action: 'session.cancelled', entity: 'session', userId: mockUser.id }),
      );
    });
  });
});
