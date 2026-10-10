import { Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
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

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('analytics.online_status.view')
  @Get('online')
  online(@Req() req: any) {
    if (!req.access['analytics.online_status.view']?.includes('GLOBAL')) {
      throw new ForbiddenException('Недостатньо прав');
    }
    return this.service.online();
  }
}