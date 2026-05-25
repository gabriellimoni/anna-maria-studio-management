import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Period } from '@anna-maria/contracts';
import { EventService } from '../../event/event.service';
import { User } from '../../user/user.entity';
import { PlanCatalog } from './entities/plan-catalog.entity';
import { CreatePlanCatalogDto } from './dto/create-plan-catalog.dto';
import { UpdatePlanCatalogDto } from './dto/update-plan-catalog.dto';
import { ListPlanCatalogQuery } from './dto/list-plan-catalog.query';

const DURATION_BY_PERIOD: Record<Period, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

@Injectable()
export class PlanCatalogService {
  constructor(
    @InjectRepository(PlanCatalog) private readonly repo: Repository<PlanCatalog>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly eventService: EventService,
  ) {}

  async create(dto: CreatePlanCatalogDto, user: User): Promise<PlanCatalog> {
    return this.dataSource.transaction(async (manager) => {
      const item = manager.create(PlanCatalog, {
        ...dto,
        durationMonths: DURATION_BY_PERIOD[dto.period],
        isActive: true,
      });
      const saved = await manager.save(PlanCatalog, item);
      await this.eventService.record(manager, {
        action: 'plan_catalog.created',
        entity: 'plan_catalog',
        entityId: saved.id,
        userId: user.id,
        dto: { name: dto.name, period: dto.period },
      });
      return saved;
    });
  }

  async findAll(query: ListPlanCatalogQuery): Promise<PlanCatalog[]> {
    const qb = this.repo.createQueryBuilder('pc');

    if (query.isActive !== undefined) {
      qb.andWhere('pc.is_active = :isActive', { isActive: query.isActive === 'true' });
    }

    return qb.orderBy('pc.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<PlanCatalog> {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new NotFoundException(`PlanCatalog ${id} not found`);
    return item;
  }

  async update(id: string, dto: UpdatePlanCatalogDto, user: User): Promise<PlanCatalog> {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(PlanCatalog, { where: { id } });
      if (!item) throw new NotFoundException(`PlanCatalog ${id} not found`);
      const durationMonths = dto.period ? DURATION_BY_PERIOD[dto.period] : item.durationMonths;
      const saved = await manager.save(PlanCatalog, { ...item, ...dto, durationMonths });
      await this.eventService.record(manager, {
        action: 'plan_catalog.updated',
        entity: 'plan_catalog',
        entityId: id,
        userId: user.id,
        dto: dto as Record<string, unknown>,
      });
      return saved;
    });
  }

  async archive(id: string, user: User): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(PlanCatalog, { where: { id } });
      if (!item) throw new NotFoundException(`PlanCatalog ${id} not found`);
      await manager.save(PlanCatalog, { ...item, isActive: false });
      await this.eventService.record(manager, {
        action: 'plan_catalog.archived',
        entity: 'plan_catalog',
        entityId: id,
        userId: user.id,
        dto: {},
      });
    });
  }
}
