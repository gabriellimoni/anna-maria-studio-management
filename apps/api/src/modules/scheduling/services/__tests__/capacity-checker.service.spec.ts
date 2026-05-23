import { CapacityCheckerService, SLOT_CAPACITY } from '../capacity-checker.service';

const makeSessions = (count: number, opts: { cancelled?: number } = {}) => {
  const all = Array.from({ length: count }, (_, i) => ({ id: `s${i}`, status: 'scheduled' }));
  for (let i = 0; i < (opts.cancelled ?? 0); i++) all[i].status = 'cancelled';
  return all;
};

const makeManager = (sessions: { id: string; status: string }[]) => {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(sessions.filter((s) => s.status !== 'cancelled').length),
  };
  return {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    _qb: qb,
  };
};

describe('CapacityCheckerService', () => {
  let service: CapacityCheckerService;

  beforeEach(() => {
    service = new CapacityCheckerService();
  });

  const at = new Date('2026-07-07T17:00:00Z');

  it('empty slot → occupied=0, isOverCapacity=false', async () => {
    const manager = makeManager([]);
    const result = await service.countSlot({ scheduledAt: at, manager: manager as any });
    expect(result).toEqual({ occupied: 0, isOverCapacity: false });
  });

  it('3 active sessions → not over capacity', async () => {
    const manager = makeManager(makeSessions(3));
    const result = await service.countSlot({ scheduledAt: at, manager: manager as any });
    expect(result).toEqual({ occupied: 3, isOverCapacity: false });
  });

  it(`${SLOT_CAPACITY} active sessions → isOverCapacity=true`, async () => {
    const manager = makeManager(makeSessions(SLOT_CAPACITY));
    const result = await service.countSlot({ scheduledAt: at, manager: manager as any });
    expect(result).toEqual({ occupied: SLOT_CAPACITY, isOverCapacity: true });
  });

  it('5 active sessions → isOverCapacity=true, does NOT throw', async () => {
    const manager = makeManager(makeSessions(5));
    await expect(service.countSlot({ scheduledAt: at, manager: manager as any })).resolves.toMatchObject({
      occupied: 5,
      isOverCapacity: true,
    });
  });

  it('4 active + 2 cancelled → query excludes cancelled (mock returns 4)', async () => {
    const sessions = [...makeSessions(4), ...makeSessions(2, { cancelled: 2 })];
    const manager = makeManager(sessions);
    const result = await service.countSlot({ scheduledAt: at, manager: manager as any });
    expect(result.isOverCapacity).toBe(true);
  });

  it('ignoreSessionIds param is passed to query builder', async () => {
    const manager = makeManager(makeSessions(3));
    await service.countSlot({ scheduledAt: at, manager: manager as any, ignoreSessionIds: ['s0'] });
    expect(manager._qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('NOT IN'), expect.anything());
  });

  it('detectOverCapacity returns only over-capacity slots', async () => {
    const service2 = new CapacityCheckerService();
    let callCount = 0;
    jest.spyOn(service2, 'countSlot').mockImplementation(async () => {
      callCount++;
      return callCount === 2
        ? { occupied: SLOT_CAPACITY, isOverCapacity: true }
        : { occupied: 1, isOverCapacity: false };
    });

    const dates = [new Date(), new Date(), new Date()];
    const warnings = await service2.detectOverCapacity({ scheduledAts: dates, manager: {} as any });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].occupied).toBe(SLOT_CAPACITY);
  });
});
