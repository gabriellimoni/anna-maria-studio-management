import { Test, TestingModule } from '@nestjs/testing';
import { PostHogService } from '../../../common/posthog/posthog.service';
import { SessionsScheduler } from '../sessions.scheduler';
import { SessionsService } from '../sessions.service';

describe('SessionsScheduler (unit)', () => {
  let scheduler: SessionsScheduler;

  const mockService = {
    closeOpenPastSessions: jest.fn(),
  };

  const mockPostHog = {
    captureException: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionsScheduler,
        { provide: SessionsService, useValue: mockService },
        { provide: PostHogService, useValue: mockPostHog },
      ],
    }).compile();

    scheduler = module.get(SessionsScheduler);
  });

  it('calls closeOpenPastSessions with a Date and logs the count', async () => {
    mockService.closeOpenPastSessions.mockResolvedValue({ updated: 3 });

    await scheduler.closeOpenPastSessions();

    expect(mockService.closeOpenPastSessions).toHaveBeenCalledTimes(1);
    const [cutoff]: [Date] = mockService.closeOpenPastSessions.mock.calls[0];
    expect(cutoff).toBeInstanceOf(Date);
  });

  it('does not call posthog.captureException on successful run', async () => {
    mockService.closeOpenPastSessions.mockResolvedValue({ updated: 0 });

    await scheduler.closeOpenPastSessions();

    expect(mockPostHog.captureException).not.toHaveBeenCalled();
  });

  it('calls posthog.captureException with distinctId=system when service throws', async () => {
    const error = new Error('DB down');
    mockService.closeOpenPastSessions.mockRejectedValue(error);

    await scheduler.closeOpenPastSessions();

    expect(mockPostHog.captureException).toHaveBeenCalledTimes(1);
    expect(mockPostHog.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ distinctId: 'system' }),
    );
  });

  it('does not rethrow when service throws', async () => {
    mockService.closeOpenPastSessions.mockRejectedValue(new Error('DB down'));
    await expect(scheduler.closeOpenPastSessions()).resolves.toBeUndefined();
  });
});
