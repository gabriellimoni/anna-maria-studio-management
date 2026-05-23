import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventService } from '../event/event.service';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly eventService: EventService,
  ) {}

  async findOrCreate(firebaseUid: string, defaults: { email: string }): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { firebaseUid } });
    if (existing) return existing;

    return this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, { firebaseUid, ...defaults, role: 'operator', isActive: true });
      const saved = await manager.save(user);
      await this.eventService.record(manager, {
        action: 'user.created',
        entity: 'user',
        entityId: saved.id,
        userId: saved.id,
        dto: { firebaseUid, ...defaults },
      });
      return saved;
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }
}
