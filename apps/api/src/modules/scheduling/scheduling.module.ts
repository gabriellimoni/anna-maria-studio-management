import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../sessions/entities/session.entity';
import { Receivable } from '../receivables/entities/receivable.entity';
import { Payable } from '../payables/entities/payable.entity';
import { SessionGeneratorService } from './services/session-generator.service';
import { ReceivablePersistService } from './services/receivable-persist.service';
import { PayableGeneratorService } from './services/payable-generator.service';
import { CapacityCheckerService } from './services/capacity-checker.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session, Receivable, Payable])],
  providers: [SessionGeneratorService, ReceivablePersistService, PayableGeneratorService, CapacityCheckerService],
  exports: [SessionGeneratorService, ReceivablePersistService, PayableGeneratorService, CapacityCheckerService],
})
export class SchedulingModule {}
