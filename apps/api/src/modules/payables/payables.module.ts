import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '../../event/event.module';
import { Payable } from './entities/payable.entity';
import { PayablesController } from './payables.controller';
import { PayablesService } from './payables.service';

@Module({
  imports: [TypeOrmModule.forFeature([Payable]), EventModule],
  controllers: [PayablesController],
  providers: [PayablesService],
  exports: [PayablesService],
})
export class PayablesModule {}
