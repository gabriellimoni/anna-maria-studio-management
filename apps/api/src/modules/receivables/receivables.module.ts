import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '../../event/event.module';
import { Receivable } from './entities/receivable.entity';
import { ReceivablesController } from './receivables.controller';
import { ReceivablesService } from './receivables.service';

@Module({
  imports: [TypeOrmModule.forFeature([Receivable]), EventModule],
  controllers: [ReceivablesController],
  providers: [ReceivablesService],
  exports: [ReceivablesService],
})
export class ReceivablesModule {}
