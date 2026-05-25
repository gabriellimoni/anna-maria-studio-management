import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { StudentsService } from '../students.service';
import { Student } from '../entities/student.entity';

type AnyFn = (...args: unknown[]) => unknown;

function makeRepo(overrides: Record<string, AnyFn> = {}): Repository<Student> {
  return {
    create: jest.fn((dto) => ({ ...dto })),
    save: jest.fn(async (entity) => ({ id: 'uuid-1', createdAt: new Date(), updatedAt: new Date(), isActive: true, ...entity })),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(),
    ...overrides,
  } as unknown as Repository<Student>;
}

const fiscalStudent: Student = {
  id: 'uuid-1',
  fullName: 'Maria Silva',
  phone: null,
  email: null,
  birthDate: null,
  notes: null,
  cpf: '123.456.789-00',
  rg: '12.345.678-9',
  addressStreet: 'Rua das Flores',
  addressNumber: '100',
  addressComplement: 'Apto 1',
  addressCity: 'São Paulo',
  addressState: 'SP',
  addressZipcode: '01310-100',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('StudentsService', () => {
  describe('create', () => {
    it('stores cpf, rg, and address fields', async () => {
      let saved: unknown = null;
      const repo = makeRepo({ save: jest.fn(async (e: Student) => { saved = e; return e; }) });
      const service = new StudentsService(repo);

      await service.create({
        fullName: 'Maria Silva',
        cpf: '123.456.789-00',
        rg: '12.345.678-9',
        addressStreet: 'Rua das Flores',
        addressNumber: '100',
        addressComplement: 'Apto 1',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipcode: '01310-100',
      });

      const entity = saved as Student;
      expect(entity.cpf).toBe('123.456.789-00');
      expect(entity.rg).toBe('12.345.678-9');
      expect(entity.addressStreet).toBe('Rua das Flores');
      expect(entity.addressCity).toBe('São Paulo');
      expect(entity.addressState).toBe('SP');
      expect(entity.addressZipcode).toBe('01310-100');
    });

    it('creates student with isActive true even without fiscal fields', async () => {
      let saved: unknown = null;
      const repo = makeRepo({ save: jest.fn(async (e) => { saved = e; return e; }) });
      const service = new StudentsService(repo);

      await service.create({ fullName: 'João' });

      expect((saved as Student).isActive).toBe(true);
      expect((saved as Student).cpf).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('returns all new fiscal and address fields', async () => {
      const repo = makeRepo({ findOneBy: jest.fn().mockResolvedValue(fiscalStudent) });
      const service = new StudentsService(repo);

      const result = await service.findOne('uuid-1');

      expect(result.cpf).toBe('123.456.789-00');
      expect(result.rg).toBe('12.345.678-9');
      expect(result.addressStreet).toBe('Rua das Flores');
      expect(result.addressCity).toBe('São Paulo');
    });

    it('throws NotFoundException when student does not exist', async () => {
      const repo = makeRepo({ findOneBy: jest.fn().mockResolvedValue(null) });
      const service = new StudentsService(repo);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('patches only the provided fiscal fields', async () => {
      let saved: unknown = null;
      const repo = makeRepo({
        findOneBy: jest.fn().mockResolvedValue({ ...fiscalStudent }),
        save: jest.fn(async (e) => { saved = e; return e; }),
      });
      const service = new StudentsService(repo);

      await service.update('uuid-1', { cpf: '999.888.777-66' });

      const entity = saved as Student;
      expect(entity.cpf).toBe('999.888.777-66');
      // untouched fields stay the same
      expect(entity.rg).toBe('12.345.678-9');
      expect(entity.addressCity).toBe('São Paulo');
    });
  });
});
