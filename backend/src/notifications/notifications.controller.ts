import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user.id);
  }

  @Post('read-all')
  readAll(@Req() req: any) {
    return this.service.markAllRead(req.user.id);
  }

  @Post(':id/read')
  read(@Req() req: any, @Param('id') id: string) {
    return this.service.markRead(req.user.id, id);
  }
}