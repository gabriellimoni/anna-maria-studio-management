import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '../../event/event.module';
import { Student } from '../students/entities/student.entity';
import { Session } from '../sessions/entities/session.entity';
import { Receivable } from '../receivables/entities/receivable.entity';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { DropInClass } from './entities/drop-in-class.entity';
import { DropInsController } from './drop-ins.controller';
import { DropInsService } from './drop-ins.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DropInClass, Session, Student, Receivable]),
    SchedulingModule,
    EventModule,
  ],
  controllers: [DropInsController],
  providers: [DropInsService],
})
export class DropInsModule {}
