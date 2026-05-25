import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../user/user.entity';
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
  createManual(@Body() dto: CreatePayableDto, @CurrentUser() user: User) {
    return this.service.createManual(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePayableDto, @CurrentUser() user: User) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/pay')
  pay(@Param('id') id: string, @Body() dto: PayPayableDto, @CurrentUser() user: User) {
    return this.service.pay(id, dto, user);
  }

  @Post(':id/unpay')
  unpay(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.unpay(id, user);
  }
}
