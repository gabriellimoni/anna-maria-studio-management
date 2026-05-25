import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '../../event/event.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { RecurringExpense } from './entities/recurring-expense.entity';
import { RecurringExpensesController } from './recurring-expenses.controller';
import { RecurringExpensesScheduler } from './recurring-expenses.scheduler';
import { RecurringExpensesService } from './recurring-expenses.service';

@Module({
  imports: [TypeOrmModule.forFeature([RecurringExpense]), SchedulingModule, EventModule],
  controllers: [RecurringExpensesController],
  providers: [RecurringExpensesService, RecurringExpensesScheduler],
  exports: [RecurringExpensesService],
})
export class RecurringExpensesModule {}
