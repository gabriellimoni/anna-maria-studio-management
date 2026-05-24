import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReceivablesService } from './receivables.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { UpdateReceivableDto } from './dto/update-receivable.dto';
import { PayReceivableDto } from './dto/pay-receivable.dto';
import { ListReceivablesQuery } from './dto/list-receivables.query';

@ApiTags('receivables')
@ApiBearerAuth()
@Controller('receivables')
export class ReceivablesController {
  constructor(private readonly service: ReceivablesService) {}

  @Get()
  findAll(@Query() query: ListReceivablesQuery) {
    return this.service.findAll(query);
  }

  @Post()
  createManual(@Body() dto: CreateReceivableDto) {
    return this.service.createManual(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReceivableDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/pay')
  pay(@Param('id') id: string, @Body() dto: PayReceivableDto) {
    return this.service.pay(id, dto);
  }

  @Post(':id/unpay')
  unpay(@Param('id') id: string) {
    return this.service.unpay(id);
  }
}
