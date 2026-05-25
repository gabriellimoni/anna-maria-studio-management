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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../user/user.entity';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { ListStudentsQuery } from './dto/list-students.query';

@ApiTags('students')
@ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Post()
  @ApiResponse({ status: 201 })
  create(@Body() dto: CreateStudentDto, @CurrentUser() user: User) {
    return this.service.create(dto, user);
  }

  @Get()
  findAll(@Query() query: ListStudentsQuery) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto, @CurrentUser() user: User) {
    return this.service.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.archive(id, user);
  }

  @Get(':id/plans')
  listPlans() {
    return [];
  }

  @Get(':id/sessions')
  listSessions() {
    return [];
  }
}
