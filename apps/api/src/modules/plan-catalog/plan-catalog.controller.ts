import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PlanCatalogService } from './plan-catalog.service';
import { CreatePlanCatalogDto } from './dto/create-plan-catalog.dto';
import { UpdatePlanCatalogDto } from './dto/update-plan-catalog.dto';
import { ListPlanCatalogQuery } from './dto/list-plan-catalog.query';

@ApiTags('plan-catalog')
@ApiBearerAuth()
@Controller('plan-catalog')
export class PlanCatalogController {
  constructor(private readonly service: PlanCatalogService) {}

  @Post()
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreatePlanCatalogDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() query: ListPlanCatalogQuery) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiResponse({ description: 'Updating catalog does not affect existing contracted plans.' })
  update(@Param('id') id: string, @Body() dto: UpdatePlanCatalogDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@Param('id') id: string) {
    return this.service.archive(id);
  }
}
