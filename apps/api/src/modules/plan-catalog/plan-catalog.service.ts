import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Period } from '@anna-maria/contracts';
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
  constructor(@InjectRepository(PlanCatalog) private readonly repo: Repository<PlanCatalog>) {}

  async create(dto: CreatePlanCatalogDto): Promise<PlanCatalog> {
    return this.repo.save(
      this.repo.create({
        ...dto,
        durationMonths: DURATION_BY_PERIOD[dto.period],
        isActive: true,
      }),
    );
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

  async update(id: string, dto: UpdatePlanCatalogDto): Promise<PlanCatalog> {
    const item = await this.findOne(id);
    const durationMonths =
      dto.period ? DURATION_BY_PERIOD[dto.period] : item.durationMonths;
    return this.repo.save({ ...item, ...dto, durationMonths });
  }

  async archive(id: string): Promise<void> {
    const item = await this.findOne(id);
    await this.repo.save({ ...item, isActive: false });
  }
}
