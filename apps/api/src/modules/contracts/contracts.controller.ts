import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../user/user.entity';
import { ContractsService } from './contracts.service';
import { CreateContractTemplateDto } from './dto/create-contract-template.dto';
import { ListContractTemplatesQuery } from './dto/list-contract-templates.query';
import { MaterializePlanContractDto } from './dto/materialize-plan-contract.dto';
import { PreviewContractTemplateDto } from './dto/preview-contract-template.dto';
import { UpdateContractTemplateDto } from './dto/update-contract-template.dto';
import { UpdatePlanContractDto } from './dto/update-plan-contract.dto';

@ApiTags('contracts')
@Controller()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  // ─── Templates ───────────────────────────────────────────────────────────────

  @Get('contract-templates')
  listTemplates(@Query() query: ListContractTemplatesQuery) {
    return this.contractsService.listTemplates(query);
  }

  @Post('contract-templates')
  createTemplate(@Body() dto: CreateContractTemplateDto, @CurrentUser() user: User) {
    return this.contractsService.createTemplate(dto, user);
  }

  @Get('contract-templates/:id')
  getTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.getTemplate(id);
  }

  @Patch('contract-templates/:id')
  updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractTemplateDto,
    @CurrentUser() user: User,
  ) {
    return this.contractsService.updateTemplate(id, dto, user);
  }

  @Delete('contract-templates/:id')
  @HttpCode(204)
  archiveTemplate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.contractsService.archiveTemplate(id, user);
  }

  @Post('contract-templates/:id/preview')
  previewTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewContractTemplateDto,
    @CurrentUser() user: User,
  ) {
    return this.contractsService.previewTemplate(id, dto, user);
  }

  // ─── Plan Contracts ───────────────────────────────────────────────────────────

  @Post('plans/:planId/contract')
  materialize(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: MaterializePlanContractDto,
    @CurrentUser() user: User,
  ) {
    return this.contractsService.materialize(planId, dto, user);
  }

  @Get('plans/:planId/contract')
  getByPlan(@Param('planId', ParseUUIDPipe) planId: string, @CurrentUser() user: User) {
    return this.contractsService.getByPlan(planId, user);
  }

  @Patch('plans/:planId/contract')
  updateDraft(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdatePlanContractDto,
    @CurrentUser() user: User,
  ) {
    return this.contractsService.updateDraft(planId, dto, user);
  }

  @Post('plans/:planId/contract/send')
  @HttpCode(200)
  send(@Param('planId', ParseUUIDPipe) planId: string, @CurrentUser() user: User) {
    return this.contractsService.send(planId, user);
  }

  @Post('plans/:planId/contract/cancel')
  @HttpCode(204)
  cancel(@Param('planId', ParseUUIDPipe) planId: string, @CurrentUser() user: User) {
    return this.contractsService.cancel(planId, user);
  }

  @Get('plans/:planId/contract/pdf')
  async downloadPdf(
    @Param('planId', ParseUUIDPipe) planId: string,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.contractsService.downloadPdf(planId, user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('plans/:planId/contract/signature-link')
  getSignatureLink(@Param('planId', ParseUUIDPipe) planId: string) {
    return this.contractsService.getSignatureLink(planId);
  }
}
