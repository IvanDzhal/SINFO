import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { PushService } from './push.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private service: NotificationsService, private push: PushService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user.id);
  }

  @Get('push/key')
  pushKey() {
    return this.push.publicKey();
  }

  @Get('push/status')
  pushStatus(@Req() req: any) {
    return this.push.status(req.user.id);
  }

  @Post('push/subscribe')
  pushSubscribe(@Req() req: any, @Body() body: any, @Headers('user-agent') ua?: string) {
    return this.push.subscribe(req.user.id, body, ua);
  }

  @Post('push/unsubscribe')
  pushUnsubscribe(@Req() req: any, @Body('endpoint') endpoint?: string) {
    return this.push.unsubscribe(req.user.id, endpoint);
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