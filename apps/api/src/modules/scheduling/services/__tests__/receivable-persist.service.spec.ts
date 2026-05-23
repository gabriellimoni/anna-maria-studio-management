import { UnprocessableEntityException } from '@nestjs/common';
import { ReceivablePersistService } from '../receivable-persist.service';
import { Plan } from '../../../plans/entities/plan.entity';
import { Receivable } from '../../../receivables/entities/receivable.entity';

const makePlan = (totalPrice: string): Plan => ({ id: 'plan-1', totalPrice } as Plan);

const makeManager = () => {
  const saved: Partial<Receivable>[] = [];
  return {
    create: jest.fn((_entity: any, data: any) => ({ ...data })),
    save: jest.fn((_entity: any, items: any[]) => {
      saved.push(...items);
      return Promise.resolve(items);
    }),
    _saved: saved,
  };
};

describe('ReceivablePersistService', () => {
  let service: ReceivablePersistService;

  beforeEach(() => {
    service = new ReceivablePersistService();
  });

  it('persists 3 equal installments with correct metadata', async () => {
    const manager = makeManager();
    const plan = makePlan('450.00');
    const result = await service.persistForPlan({
      plan,
      installments: [
        { amount: '150.00', dueDate: '2026-07-01' },
        { amount: '150.00', dueDate: '2026-08-01' },
        { amount: '150.00', dueDate: '2026-09-01' },
      ],
      manager: manager as any,
    });
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ source: 'plan', installmentNumber: 1, installmentTotal: 3, planId: 'plan-1' });
    expect(result[2]).toMatchObject({ installmentNumber: 3 });
  });

  it('allows first installment as paid with paidAt', async () => {
    const manager = makeManager();
    const plan = makePlan('450.00');
    const result = await service.persistForPlan({
      plan,
      installments: [
        { amount: '150.00', dueDate: '2026-07-01', status: 'paid', paidAt: '2026-07-01' },
        { amount: '150.00', dueDate: '2026-08-01' },
        { amount: '150.00', dueDate: '2026-09-01' },
      ],
      manager: manager as any,
    });
    expect(result[0]).toMatchObject({ status: 'paid', paidAt: '2026-07-01' });
  });

  it('throws 422 when paid installment has no paidAt', async () => {
    const manager = makeManager();
    const plan = makePlan('450.00');
    await expect(
      service.persistForPlan({
        plan,
        installments: [{ amount: '450.00', dueDate: '2026-07-01', status: 'paid' }],
        manager: manager as any,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('accepts sum within 1-cent tolerance (449.99 vs 450.00)', async () => {
    const manager = makeManager();
    const plan = makePlan('450.00');
    await expect(
      service.persistForPlan({
        plan,
        installments: [
          { amount: '200.00', dueDate: '2026-07-01' },
          { amount: '249.99', dueDate: '2026-08-01' },
        ],
        manager: manager as any,
      }),
    ).resolves.toHaveLength(2);
  });

  it('rejects sum too far off (449.50 vs 450.00)', async () => {
    const manager = makeManager();
    const plan = makePlan('450.00');
    await expect(
      service.persistForPlan({
        plan,
        installments: [
          { amount: '200.00', dueDate: '2026-07-01' },
          { amount: '249.50', dueDate: '2026-08-01' },
        ],
        manager: manager as any,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('handles 100.00 split as 33.33+33.33+33.34', async () => {
    const manager = makeManager();
    const plan = makePlan('100.00');
    await expect(
      service.persistForPlan({
        plan,
        installments: [
          { amount: '33.33', dueDate: '2026-07-01' },
          { amount: '33.33', dueDate: '2026-08-01' },
          { amount: '33.34', dueDate: '2026-09-01' },
        ],
        manager: manager as any,
      }),
    ).resolves.toHaveLength(3);
  });

  it('persists single installment with installmentNumber/Total = 1/1', async () => {
    const manager = makeManager();
    const plan = makePlan('450.00');
    const result = await service.persistForPlan({
      plan,
      installments: [{ amount: '450.00', dueDate: '2026-07-01' }],
      manager: manager as any,
    });
    expect(result[0]).toMatchObject({ installmentNumber: 1, installmentTotal: 1 });
  });

  it('throws 422 when installments array is empty', async () => {
    const manager = makeManager();
    const plan = makePlan('450.00');
    await expect(
      service.persistForPlan({ plan, installments: [], manager: manager as any }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
