import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../user/user.entity';
import { DropInsService } from './drop-ins.service';
import { CreateDropInDto } from './dto/create-drop-in.dto';
import { ListDropInsQuery } from './dto/list-drop-ins.query';
import { UpdateDropInDto } from './dto/update-drop-in.dto';

@ApiTags('drop-ins')
@ApiBearerAuth()
@Controller('drop-ins')
export class DropInsController {
  constructor(private readonly dropInsService: DropInsService) {}

  @Get()
  findAll(@Query() query: ListDropInsQuery) {
    return this.dropInsService.findAll(query);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateDropInDto, @CurrentUser() user: User) {
    return this.dropInsService.create(dto, user);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.dropInsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDropInDto, @CurrentUser() user: User) {
    return this.dropInsService.update(id, dto, user);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.dropInsService.remove(id, user);
  }
}
