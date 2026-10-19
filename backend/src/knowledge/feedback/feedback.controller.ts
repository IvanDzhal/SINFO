import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { ItemKeyPipe } from '../item-key.pipe';
import { FeedbackService } from './feedback.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('knowledge')
export class FeedbackController {
  constructor(private service: FeedbackService) {}

  @Permissions('knowledge.view')
  @Post('items/:id/feedback')
  create(
    @Req() req: any,
    @Param('id', ItemKeyPipe) id: string,
    @Body('kind') kind: string,
    @Body('comment') comment: string,
  ) {
    return this.service.create(req.user, id, kind, comment);
  }

  @Permissions('knowledge.edit')
  @Get('feedback')
  list(@Req() req: any, @Query('status') status?: string) {
    return this.service.list(req.user, status ?? 'open');
  }

  @Permissions('knowledge.edit')
  @Get('feedback/count')
  count(@Req() req: any) {
    return this.service.openCount(req.user);
  }

  @Permissions('knowledge.edit')
  @Patch('feedback/:id/resolve')
  resolve(@Req() req: any, @Param('id') id: string) {
    return this.service.setStatus(req.user, id, true);
  }

  @Permissions('knowledge.edit')
  @Patch('feedback/:id/reopen')
  reopen(@Req() req: any, @Param('id') id: string) {
    return this.service.setStatus(req.user, id, false);
  }
}
