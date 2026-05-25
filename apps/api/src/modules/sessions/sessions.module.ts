import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '../../event/event.module';
import { Student } from '../students/entities/student.entity';
import { Session } from './entities/session.entity';
import { SessionsController } from './sessions.controller';
import { SessionsScheduler } from './sessions.scheduler';
import { SessionsService } from './sessions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Session, Student]), EventModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsScheduler],
  exports: [SessionsService],
})
export class SessionsModule {}
