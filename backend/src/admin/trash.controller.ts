import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { TrashService } from './trash.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/trash')
export class TrashController {
  constructor(private service: TrashService) {}

  @Permissions('admin.access')
  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user);
  }
}
