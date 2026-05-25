import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../user/user.entity';
import { RecurringExpensesService } from './recurring-expenses.service';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense.dto';
import { ListRecurringExpensesQuery } from './dto/list-recurring-expenses.query';
import { RunGenerationDto } from './dto/run-generation.dto';

@ApiTags('recurring-expenses')
@ApiBearerAuth()
@Controller('recurring-expenses')
export class RecurringExpensesController {
  constructor(private readonly service: RecurringExpensesService) {}

  @Get()
  findAll(@Query() query: ListRecurringExpensesQuery) {
    return this.service.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateRecurringExpenseDto, @CurrentUser() user: User) {
    return this.service.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRecurringExpenseDto, @CurrentUser() user: User) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user);
  }

  @Post('run-generation')
  runGeneration(@Body() dto: RunGenerationDto) {
    const competenceMonth = new Date(`${dto.competenceMonth}-01T00:00:00Z`);
    return this.service.runForMonth(competenceMonth);
  }
}
