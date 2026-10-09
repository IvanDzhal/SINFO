import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard as AccessGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { PermissionsService } from './permissions.service';

@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('core/permissions')
export class PermissionsController {
  constructor(private service: PermissionsService) {}

  @Permissions('core.roles.view')
  @Get()
  list() {
    return this.service.list();
  }
}