import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DomainEvent } from './domain-event.entity';

export interface RecordEventOptions {
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  dto: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

@Injectable()
export class EventService {
  async record(manager: EntityManager, opts: RecordEventOptions): Promise<void> {
    const event = manager.create(DomainEvent, {
      action: opts.action,
      entity: opts.entity,
      entityId: opts.entityId,
      payload: {
        userId: opts.userId,
        dto: opts.dto,
        ...opts.extra,
      },
    });
    await manager.save(DomainEvent, event);
  }
}
