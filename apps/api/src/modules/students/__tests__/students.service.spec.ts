import { NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { StudentsService } from '../students.service';
import { Student } from '../entities/student.entity';
import { EventService } from '../../../event/event.service';
import { User } from '../../../user/user.entity';

type AnyFn = (...args: unknown[]) => unknown;

const mockUser = { id: 'user-uuid-1' } as User;

function makeManager(overrides: Record<string, AnyFn> = {}): EntityManager {
  return {
    create: jest.fn((_, dto) => ({ ...dto })),
    save: jest.fn(async (_, entity) => ({ id: 'uuid-1', createdAt: new Date(), updatedAt: new Date(), isActive: true, ...entity })),
    findOne: jest.fn(),
    ...overrides,
  } as unknown as EntityManager;
}

function makeDataSource(manager: EntityManager, repoOverrides: Record<string, AnyFn> = {}): DataSource {
  const repo = {
    createQueryBuilder: jest.fn(),
    findOneBy: jest.fn(),
    ...repoOverrides,
  };
  return {
    transaction: jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) => cb(manager)),
    getRepository: jest.fn().mockReturnValue(repo),
  } as unknown as DataSource;
}

function makeEventService(): EventService {
  return { record: jest.fn() } as unknown as EventService;
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
      let savedEntity: unknown = null;
      const manager = makeManager({
        save: jest.fn(async (_cls: unknown, entity: Student) => { savedEntity = entity; return { ...entity, id: entity.id ?? 'uuid-1' } as Student; }),
      });
      const dataSource = makeDataSource(manager);
      const service = new StudentsService(dataSource, makeEventService());

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
      }, mockUser);

      const entity = savedEntity as Student;
      expect(entity.cpf).toBe('123.456.789-00');
      expect(entity.rg).toBe('12.345.678-9');
      expect(entity.addressStreet).toBe('Rua das Flores');
      expect(entity.addressCity).toBe('São Paulo');
      expect(entity.addressState).toBe('SP');
      expect(entity.addressZipcode).toBe('01310-100');
    });

    it('creates student with isActive true even without fiscal fields', async () => {
      let savedEntity: unknown = null;
      const manager = makeManager({
        save: jest.fn(async (_cls: unknown, entity: Student) => { savedEntity = entity; return { ...entity, id: entity.id ?? 'uuid-1' } as Student; }),
      });
      const dataSource = makeDataSource(manager);
      const service = new StudentsService(dataSource, makeEventService());

      await service.create({ fullName: 'João' }, mockUser);

      expect((savedEntity as Student).isActive).toBe(true);
    });

    it('records a student.created domain event', async () => {
      const manager = makeManager({
        save: jest.fn(async (_cls: unknown, entity: Student) => ({ ...entity, id: entity.id ?? 'uuid-1' } as Student)),
      });
      const dataSource = makeDataSource(manager);
      const eventService = makeEventService();
      const service = new StudentsService(dataSource, eventService);

      await service.create({ fullName: 'Maria' }, mockUser);

      expect(eventService.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ action: 'student.created', entity: 'student', userId: mockUser.id }),
      );
    });
  });

  describe('findOne', () => {
    it('returns all new fiscal and address fields', async () => {
      const manager = makeManager();
      const dataSource = makeDataSource(manager, {
        findOneBy: jest.fn().mockResolvedValue(fiscalStudent),
      });
      const service = new StudentsService(dataSource, makeEventService());

      const result = await service.findOne('uuid-1');

      expect(result.cpf).toBe('123.456.789-00');
      expect(result.rg).toBe('12.345.678-9');
      expect(result.addressStreet).toBe('Rua das Flores');
      expect(result.addressCity).toBe('São Paulo');
    });

    it('throws NotFoundException when student does not exist', async () => {
      const manager = makeManager();
      const dataSource = makeDataSource(manager, {
        findOneBy: jest.fn().mockResolvedValue(null),
      });
      const service = new StudentsService(dataSource, makeEventService());

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('patches only the provided fiscal fields', async () => {
      let savedEntity: unknown = null;
      const manager = makeManager({
        findOne: jest.fn().mockResolvedValue({ ...fiscalStudent }),
        save: jest.fn(async (_cls: unknown, entity: Student) => { savedEntity = entity; return entity; }),
      });
      const dataSource = makeDataSource(manager);
      const service = new StudentsService(dataSource, makeEventService());

      await service.update('uuid-1', { cpf: '999.888.777-66' }, mockUser);

      const entity = savedEntity as Student;
      expect(entity.cpf).toBe('999.888.777-66');
      expect(entity.rg).toBe('12.345.678-9');
      expect(entity.addressCity).toBe('São Paulo');
    });

    it('records a student.updated domain event', async () => {
      const manager = makeManager({
        findOne: jest.fn().mockResolvedValue({ ...fiscalStudent }),
        save: jest.fn(async (_cls: unknown, entity: Student) => entity),
      });
      const dataSource = makeDataSource(manager);
      const eventService = makeEventService();
      const service = new StudentsService(dataSource, eventService);

      await service.update('uuid-1', { cpf: '999.888.777-66' }, mockUser);

      expect(eventService.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ action: 'student.updated', entity: 'student', userId: mockUser.id }),
      );
    });
  });

  describe('archive', () => {
    it('sets isActive to false', async () => {
      let savedEntity: unknown = null;
      const manager = makeManager({
        findOne: jest.fn().mockResolvedValue({ ...fiscalStudent, isActive: true }),
        save: jest.fn(async (_cls: unknown, entity: Student) => { savedEntity = entity; return entity; }),
      });
      const dataSource = makeDataSource(manager);
      const service = new StudentsService(dataSource, makeEventService());

      await service.archive('uuid-1', mockUser);

      expect((savedEntity as Student).isActive).toBe(false);
    });

    it('records a student.archived domain event', async () => {
      const manager = makeManager({
        findOne: jest.fn().mockResolvedValue({ ...fiscalStudent }),
        save: jest.fn(async (_cls: unknown, entity: Student) => entity),
      });
      const dataSource = makeDataSource(manager);
      const eventService = makeEventService();
      const service = new StudentsService(dataSource, eventService);

      await service.archive('uuid-1', mockUser);

      expect(eventService.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({ action: 'student.archived', entity: 'student', userId: mockUser.id }),
      );
    });
  });
});
