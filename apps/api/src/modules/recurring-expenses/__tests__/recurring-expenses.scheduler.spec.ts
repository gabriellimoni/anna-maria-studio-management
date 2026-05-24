import { Test, TestingModule } from '@nestjs/testing';
import { PostHogService } from '../../../common/posthog/posthog.service';
import { RecurringExpensesScheduler } from '../recurring-expenses.scheduler';
import { RecurringExpensesService } from '../recurring-expenses.service';

describe('RecurringExpensesScheduler (unit)', () => {
  let scheduler: RecurringExpensesScheduler;

  const mockService = {
    runForMonth: jest.fn(),
  };

  const mockPostHog = {
    captureException: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringExpensesScheduler,
        { provide: RecurringExpensesService, useValue: mockService },
        { provide: PostHogService, useValue: mockPostHog },
      ],
    }).compile();

    scheduler = module.get(RecurringExpensesScheduler);
  });

  it('calls runForMonth with the first day of next month at UTC midnight', async () => {
    mockService.runForMonth.mockResolvedValue({ created: 2, skipped: 1, errors: [] });

    await scheduler.generateNextMonthPayables();

    expect(mockService.runForMonth).toHaveBeenCalledTimes(1);
    const calledDate: Date = mockService.runForMonth.mock.calls[0][0];
    expect(calledDate).toBeInstanceOf(Date);
    expect(calledDate.getUTCDate()).toBe(1);
    expect(calledDate.getUTCHours()).toBe(0);
    expect(calledDate.getUTCMinutes()).toBe(0);
    expect(calledDate.getUTCSeconds()).toBe(0);
  });

  it('does not call posthog.captureException on successful run', async () => {
    mockService.runForMonth.mockResolvedValue({ created: 3, skipped: 0, errors: [] });

    await scheduler.generateNextMonthPayables();

    expect(mockPostHog.captureException).not.toHaveBeenCalled();
  });

  it('calls posthog.captureException with distinctId=system when service throws', async () => {
    const error = new Error('DB down');
    mockService.runForMonth.mockRejectedValue(error);

    await scheduler.generateNextMonthPayables();

    expect(mockPostHog.captureException).toHaveBeenCalledTimes(1);
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ distinctId: 'system' }),
    );
  });

  it('does not rethrow when service throws', async () => {
    mockService.runForMonth.mockRejectedValue(new Error('DB down'));
    await expect(scheduler.generateNextMonthPayables()).resolves.toBeUndefined();
  });
});
