import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventModule } from '../../event/event.module';
import { ContractTemplate } from './entities/contract-template.entity';
import { PlanContract } from './entities/plan-contract.entity';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { PublicContractsController } from './public-contracts.controller';
import { VariableResolverService } from './variable-resolver.service';
import { MarkdownRendererService } from './markdown-renderer.service';
import { PdfGeneratorService } from './pdf/pdf-generator.service';
import { FirebaseStorageProvider } from './storage/firebase-storage.provider';
import { CONTRACT_STORAGE } from './storage/contract-storage.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContractTemplate, PlanContract]),
    EventModule,
  ],
  providers: [
    ContractsService,
    VariableResolverService,
    MarkdownRendererService,
    PdfGeneratorService,
    { provide: CONTRACT_STORAGE, useClass: FirebaseStorageProvider },
  ],
  controllers: [ContractsController, PublicContractsController],
})
export class ContractsModule {}
