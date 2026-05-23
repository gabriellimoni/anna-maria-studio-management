import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Session } from '../../sessions/entities/session.entity';

export const SLOT_CAPACITY = 4;

@Injectable()
export class CapacityCheckerService {
  /** Returns current occupancy for a slot. Never throws. */
  async countSlot(input: {
    scheduledAt: Date;
    manager: EntityManager;
    ignoreSessionIds?: string[];
  }): Promise<{ occupied: number; isOverCapacity: boolean }> {
    const { scheduledAt, manager, ignoreSessionIds = [] } = input;

    const qb = manager
      .createQueryBuilder(Session, 's')
      .where('s.scheduled_at = :scheduledAt', { scheduledAt })
      .andWhere("s.status <> 'cancelled'");

    if (ignoreSessionIds.length > 0) {
      qb.andWhere('s.id NOT IN (:...ignoreSessionIds)', { ignoreSessionIds });
    }

    const occupied = await qb.getCount();
    return { occupied, isOverCapacity: occupied >= SLOT_CAPACITY };
  }

  /** Returns only over-capacity slots from a list. Never throws. */
  async detectOverCapacity(input: {
    scheduledAts: Date[];
    manager: EntityManager;
    ignoreSessionIds?: string[];
  }): Promise<Array<{ scheduledAt: Date; occupied: number }>> {
    const { scheduledAts, manager, ignoreSessionIds } = input;
    const warnings: Array<{ scheduledAt: Date; occupied: number }> = [];

    for (const scheduledAt of scheduledAts) {
      const { occupied, isOverCapacity } = await this.countSlot({ scheduledAt, manager, ignoreSessionIds });
      if (isOverCapacity) {
        warnings.push({ scheduledAt, occupied });
      }
    }
    return warnings;
  }
}
