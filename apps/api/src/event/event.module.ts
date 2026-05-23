import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEvent } from './domain-event.entity';
import { EventService } from './event.service';

@Module({
  imports: [TypeOrmModule.forFeature([DomainEvent])],
  providers: [EventService],
  exports: [EventService],
})
export class EventModule {}
