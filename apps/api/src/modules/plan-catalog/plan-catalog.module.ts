import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '../../event/event.module';
import { PlanCatalog } from './entities/plan-catalog.entity';
import { PlanCatalogService } from './plan-catalog.service';
import { PlanCatalogController } from './plan-catalog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlanCatalog]), EventModule],
  controllers: [PlanCatalogController],
  providers: [PlanCatalogService],
  exports: [PlanCatalogService],
})
export class PlanCatalogModule {}
