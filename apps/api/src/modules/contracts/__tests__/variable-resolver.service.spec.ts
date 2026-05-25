import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { VariableResolverService } from '../variable-resolver.service';
import type { User } from '../../../user/user.entity';

const mockUser: User = { id: 'u1', email: 'owner@studio.com', role: 'operator', isActive: true, studentId: null, createdAt: new Date(), updatedAt: new Date(), firebaseUid: 'uid' };

const baseRow = {
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
  studentCpf: '123.456.789-00',
  studentRg: '12.345.678-9',
  studentAddressStreet: 'Rua das Flores',
  studentAddressNumber: '100',
  studentAddressComplement: 'Apto 1',
  studentAddressCity: 'São Paulo',
  studentAddressState: 'SP',
  studentAddressZipcode: '01310-100',
  planCatalogName: 'Pilates Mensal',
};

function makeDs(rowOverrides = {}) {
  return {
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('FROM plan p')) {
        return Promise.resolve([{ ...baseRow, ...rowOverrides }]);
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

  it('resolves studentCpf and studentRg', async () => {
    const vars = await service.resolve('plan-1', mockUser);
    expect(vars.studentCpf).toBe('123.456.789-00');
    expect(vars.studentRg).toBe('12.345.678-9');
  });

  it('returns empty string for null fiscal fields', async () => {
    const service2 = new VariableResolverService(
      makeDs({ studentCpf: null, studentRg: null }),
      { get: jest.fn().mockReturnValue('Studio') } as unknown as ConfigService,
    );
    const vars = await service2.resolve('plan-1', mockUser);
    expect(vars.studentCpf).toBe('');
    expect(vars.studentRg).toBe('');
  });

  it('resolves studentAddress with all parts', async () => {
    const vars = await service.resolve('plan-1', mockUser);
    expect(vars.studentAddress).toContain('Rua das Flores');
    expect(vars.studentAddress).toContain('100');
    expect(vars.studentAddress).toContain('Apto 1');
    expect(vars.studentAddress).toContain('São Paulo');
    expect(vars.studentAddress).toContain('SP');
    expect(vars.studentAddress).toContain('01310-100');
  });

  it('resolves studentAddress gracefully when address fields are null', async () => {
    const service3 = new VariableResolverService(
      makeDs({
        studentAddressStreet: null, studentAddressNumber: null, studentAddressComplement: null,
        studentAddressCity: null, studentAddressState: null, studentAddressZipcode: null,
      }),
      { get: jest.fn().mockReturnValue('Studio') } as unknown as ConfigService,
    );
    const vars = await service3.resolve('plan-1', mockUser);
    expect(vars.studentAddress).toBe('');
  });

  it('dummyVars includes cpf, rg, and address', () => {
    const vars = service.dummyVars(mockUser);
    expect(vars.studentCpf).toBeTruthy();
    expect(vars.studentRg).toBeTruthy();
    expect(vars.studentAddress).toBeTruthy();
  });
});
