import { Test, TestingModule } from '@nestjs/testing';
import { RecurringExpensesController } from '../recurring-expenses.controller';
import { RecurringExpensesService } from '../recurring-expenses.service';
import { User } from '../../../user/user.entity';

const mockUser = { id: 'user-uuid-1' } as User;

describe('RecurringExpensesController (unit)', () => {
  let controller: RecurringExpensesController;

  const mockService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    runForMonth: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecurringExpensesController],
      providers: [{ provide: RecurringExpensesService, useValue: mockService }],
    }).compile();

    controller = module.get(RecurringExpensesController);
  });

  it('findAll delegates query to service', async () => {
    mockService.findAll.mockResolvedValue({ data: [], total: 0 });
    const query = { isActive: true };
    await controller.findAll(query as never);
    expect(mockService.findAll).toHaveBeenCalledWith(query);
  });

  it('create delegates dto and user to service', async () => {
    const dto = { description: 'Aluguel', expectedAmount: '2000.00', dueDay: 10 };
    mockService.create.mockResolvedValue({ id: '1', ...dto, isActive: true });
    await controller.create(dto as never, mockUser);
    expect(mockService.create).toHaveBeenCalledWith(dto, mockUser);
  });

  it('findOne delegates id to service', async () => {
    mockService.findOne.mockResolvedValue({ id: '1' });
    await controller.findOne('1');
    expect(mockService.findOne).toHaveBeenCalledWith('1');
  });

  it('update delegates id, dto, and user to service', async () => {
    mockService.update.mockResolvedValue({ id: '1' });
    const dto = { description: 'Novo nome' };
    await controller.update('1', dto as never, mockUser);
    expect(mockService.update).toHaveBeenCalledWith('1', dto, mockUser);
  });

  it('remove delegates id and user to service', async () => {
    mockService.remove.mockResolvedValue(undefined);
    await controller.remove('1', mockUser);
    expect(mockService.remove).toHaveBeenCalledWith('1', mockUser);
  });

  describe('runGeneration()', () => {
    it('parses YYYY-MM to UTC first-of-month Date and calls runForMonth', async () => {
      mockService.runForMonth.mockResolvedValue({ created: 1, skipped: 0, errors: [] });

      await controller.runGeneration({ competenceMonth: '2026-07' });

      expect(mockService.runForMonth).toHaveBeenCalledTimes(1);
      const calledDate: Date = mockService.runForMonth.mock.calls[0][0];
      expect(calledDate).toBeInstanceOf(Date);
      expect(calledDate.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    });

    it('parses January correctly (zero-padded month)', async () => {
      mockService.runForMonth.mockResolvedValue({ created: 0, skipped: 0, errors: [] });

      await controller.runGeneration({ competenceMonth: '2027-01' });

      const calledDate: Date = mockService.runForMonth.mock.calls[0][0];
      expect(calledDate.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    });
  });
});
