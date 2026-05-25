import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '../../event/event.module';
import { Student } from './entities/student.entity';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Student]), EventModule],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}
