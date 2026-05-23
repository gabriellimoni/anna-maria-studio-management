import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanCatalog } from './entities/plan-catalog.entity';
import { PlanCatalogService } from './plan-catalog.service';
import { PlanCatalogController } from './plan-catalog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PlanCatalog])],
  controllers: [PlanCatalogController],
  providers: [PlanCatalogService],
  exports: [PlanCatalogService],
})
export class PlanCatalogModule {}
