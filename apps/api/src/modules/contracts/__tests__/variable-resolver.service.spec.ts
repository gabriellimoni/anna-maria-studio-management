import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { VariableResolverService } from '../variable-resolver.service';
import type { User } from '../../../user/user.entity';

const mockUser: User = { id: 'u1', email: 'owner@studio.com', role: 'operator', isActive: true, studentId: null, createdAt: new Date(), updatedAt: new Date(), firebaseUid: 'uid' };

function makeDs(rowOverrides = {}) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM plan p')) {
        return Promise.resolve([{
          id: 'plan-1',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          totalPrice: '480.00',
          weeklyFrequency: 2,
          period: 'monthly',
          paymentMethod: 'pix',
          studentName: 'Maria Silva',
          studentEmail: 'maria@test.com',
          studentPhone: '11999999999',
          planCatalogName: 'Pilates Mensal',
          ...rowOverrides,
        }]);
      }
      return Promise.resolve([{ amount: '480.00' }]);
    }),
  } as unknown as DataSource;
}

describe('VariableResolverService', () => {
  let service: VariableResolverService;

  beforeEach(() => {
    const config = { get: jest.fn().mockReturnValue('Anna Maria Studio') } as unknown as ConfigService;
    service = new VariableResolverService(makeDs(), config);
  });

  it('resolves all variables', async () => {
    const vars = await service.resolve('plan-1', mockUser);
    expect(vars.studentName).toBe('Maria Silva');
    expect(vars.planName).toBe('Pilates Mensal');
    expect(vars.totalPrice).toContain('R$');
    expect(vars.studioName).toBe('Anna Maria Studio');
    expect(vars.studioOwnerName).toBe('owner@studio.com');
    expect(vars.todayDate).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('formats currency in BRL', async () => {
    const vars = await service.resolve('plan-1', mockUser);
    expect(vars.totalPrice).toContain('480');
  });

  it('returns dummy vars when no planId', () => {
    const vars = service.dummyVars(mockUser);
    expect(vars.studentName).toBe('Maria Silva');
    expect(vars.todayDate).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
