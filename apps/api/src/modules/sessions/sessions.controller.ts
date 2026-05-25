import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../user/user.entity';
import { SessionsService } from './sessions.service';
import { CalendarQuery } from './dto/calendar.query';
import { CancelSessionDto } from './dto/cancel-session.dto';
import { ListSessionsQuery } from './dto/list-sessions.query';
import { UpdateSessionDto } from './dto/update-session.dto';

@ApiTags('sessions')
@ApiBearerAuth()
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  findAll(@Query() query: ListSessionsQuery) {
    return this.sessionsService.findAll(query);
  }

  @Get('calendar')
  getCalendar(@Query() query: CalendarQuery) {
    return this.sessionsService.getCalendar(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sessionsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSessionDto, @CurrentUser() user: User) {
    return this.sessionsService.updateSession(id, dto, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelSessionDto, @CurrentUser() user: User) {
    return this.sessionsService.cancelSession(id, dto, user);
  }
}
