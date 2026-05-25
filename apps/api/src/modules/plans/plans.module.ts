import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '../../event/event.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { StudentsModule } from '../students/students.module';
import { PlanCatalogModule } from '../plan-catalog/plan-catalog.module';
import { Plan } from './entities/plan.entity';
import { PlanSchedule } from './entities/plan-schedule.entity';
import { PlansService } from './plans.service';
import { PlansController } from './plans.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Plan, PlanSchedule]),
    SchedulingModule,
    StudentsModule,
    PlanCatalogModule,
    EventModule,
  ],
  providers: [PlansService],
  controllers: [PlansController],
})
export class PlansModule {}
