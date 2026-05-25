import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../user/user.entity';
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
  createManual(@Body() dto: CreateReceivableDto, @CurrentUser() user: User) {
    return this.service.createManual(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateReceivableDto, @CurrentUser() user: User) {
    return this.service.update(id, dto, user);
  }

  @Post(':id/pay')
  pay(@Param('id') id: string, @Body() dto: PayReceivableDto, @CurrentUser() user: User) {
    return this.service.pay(id, dto, user);
  }

  @Post(':id/unpay')
  unpay(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.unpay(id, user);
  }

  @Post(':id/mark-invoiced')
  markInvoiced(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.markInvoiced(id, user);
  }

  @Post(':id/unmark-invoiced')
  unmarkInvoiced(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.unmarkInvoiced(id, user);
  }
}
