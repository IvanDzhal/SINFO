import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PresenceService } from './presence.service';

@Controller('presence')
export class PresenceController {
  constructor(private service: PresenceService) {}

  @UseGuards(JwtAuthGuard)
  @Post('heartbeat')
  async heartbeat(@Req() req: any) {
    await this.service.heartbeat(req.user.id);
    return { ok: true };
  }

  // Онлайн бачать усі авторизовані користувачі
  @UseGuards(JwtAuthGuard)
  @Get('online')
  online(@Req() req: any) {
    return this.service.online(req.user);
  }
}
