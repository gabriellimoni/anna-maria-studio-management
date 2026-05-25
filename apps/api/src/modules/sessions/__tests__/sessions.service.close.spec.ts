import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { EventService } from '../../../event/event.service';
import { SessionsService } from '../sessions.service';

function makeQb(executeResult: { affected: number }) {
  const qb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(executeResult),
  };
  return qb;
}

describe('SessionsService.closeOpenPastSessions (unit)', () => {
  let service: SessionsService;

  const mockDataSource = {
    createQueryBuilder: jest.fn(),
    getRepository: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
        { provide: EventService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(SessionsService);
  });

  it('returns count of updated rows', async () => {
    const qb = makeQb({ affected: 5 });
    mockDataSource.createQueryBuilder.mockReturnValue(qb);

    const cutoff = new Date('2026-05-24T23:00:00Z');
    const result = await service.closeOpenPastSessions(cutoff);

    expect(result).toEqual({ updated: 5 });
    expect(qb.update).toHaveBeenCalledTimes(1);
    expect(qb.set).toHaveBeenCalledWith({ status: 'present' });
    expect(qb.where).toHaveBeenCalledWith('status = :status', { status: 'scheduled' });
    expect(qb.andWhere).toHaveBeenCalledWith('scheduled_at < :cutoff', { cutoff });
  });

  it('returns 0 when no rows matched', async () => {
    const qb = makeQb({ affected: 0 });
    mockDataSource.createQueryBuilder.mockReturnValue(qb);

    const result = await service.closeOpenPastSessions(new Date());

    expect(result).toEqual({ updated: 0 });
  });

  it('handles null affected gracefully', async () => {
    const qb = makeQb({ affected: null as unknown as number });
    mockDataSource.createQueryBuilder.mockReturnValue(qb);

    const result = await service.closeOpenPastSessions(new Date());

    expect(result).toEqual({ updated: 0 });
  });
});
