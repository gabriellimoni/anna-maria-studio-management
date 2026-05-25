import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CancelPlanDto } from './dto/cancel-plan.dto';
import { ChangeScheduleDto } from './dto/change-schedule.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { ListPlansQuery } from './dto/list-plans.query';
import { RenewPlanDto } from './dto/renew-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get('check-capacity')
  checkCapacity(
    @Query('weekday', ParseIntPipe) weekday: number,
    @Query('startTime') startTime: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.plansService.checkCapacity(weekday, startTime, from, to);
  }

  @Get()
  findAll(@Query() query: ListPlansQuery) {
    return this.plansService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.findOne(id);
  }

  @Patch(':id')
  updateBasics(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.updateBasics(id, dto);
  }

  @Post(':id/change-schedule')
  @HttpCode(200)
  changeSchedule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeScheduleDto) {
    return this.plansService.changeSchedule(id, dto);
  }

  @Post(':id/renew')
  @HttpCode(200)
  renew(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RenewPlanDto) {
    return this.plansService.renew(id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelPlanDto) {
    return this.plansService.cancel(id, dto);
  }

  @Post(':id/finish')
  @HttpCode(200)
  finish(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.finish(id);
  }
}
