import { Test, TestingModule } from '@nestjs/testing';
import { DomainEvent } from './domain-event.entity';
import { EventService } from './event.service';

describe('EventService', () => {
  let service: EventService;
  let manager: any;

  beforeEach(async () => {
    manager = {
      create: jest.fn((_entity: any, data: any) => data),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [EventService],
    }).compile();

    service = module.get(EventService);
  });

  it('creates and saves a domain event via the provided manager', async () => {
    await service.record(manager, {
      action: 'company.created',
      entity: 'company',
      entityId: 'company-1',
      userId: 'user-1',
      dto: { legalName: 'Acme LTDA', tradeName: 'Acme' },
    });

    expect(manager.create).toHaveBeenCalledWith(DomainEvent, {
      action: 'company.created',
      entity: 'company',
      entityId: 'company-1',
      payload: {
        userId: 'user-1',
        dto: { legalName: 'Acme LTDA', tradeName: 'Acme' },
      },
    });
    expect(manager.save).toHaveBeenCalledWith(DomainEvent, expect.objectContaining({ action: 'company.created' }));
  });

  it('merges extra fields into payload', async () => {
    await service.record(manager, {
      action: 'reminder.completed',
      entity: 'reminder',
      entityId: 'reminder-1',
      userId: 'user-1',
      dto: { status: 'done' },
      extra: { previousStatus: 'pending' },
    });

    expect(manager.create).toHaveBeenCalledWith(DomainEvent, {
      action: 'reminder.completed',
      entity: 'reminder',
      entityId: 'reminder-1',
      payload: {
        userId: 'user-1',
        dto: { status: 'done' },
        previousStatus: 'pending',
      },
    });
  });

  it('accepts "public" as userId for unauthenticated actions', async () => {
    await service.record(manager, {
      action: 'campaign_customer.interested',
      entity: 'campaign_customer',
      entityId: 'cc-1',
      userId: 'public',
      dto: { token: 'abc123', response: 'interested' },
    });

    const createArg = manager.create.mock.calls[0][1];
    expect(createArg.payload.userId).toBe('public');
  });
});
