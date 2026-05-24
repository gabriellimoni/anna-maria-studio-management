import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PayablesService } from './payables.service';
import { CreatePayableDto } from './dto/create-payable.dto';
import { UpdatePayableDto } from './dto/update-payable.dto';
import { PayPayableDto } from './dto/pay-payable.dto';
import { ListPayablesQuery } from './dto/list-payables.query';

@ApiTags('payables')
@ApiBearerAuth()
@Controller('payables')
export class PayablesController {
  constructor(private readonly service: PayablesService) {}

  @Get()
  findAll(@Query() query: ListPayablesQuery) {
    return this.service.findAll(query);
  }

  @Post()
  createManual(@Body() dto: CreatePayableDto) {
    return this.service.createManual(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePayableDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/pay')
  pay(@Param('id') id: string, @Body() dto: PayPayableDto) {
    return this.service.pay(id, dto);
  }

  @Post(':id/unpay')
  unpay(@Param('id') id: string) {
    return this.service.unpay(id);
  }
}
