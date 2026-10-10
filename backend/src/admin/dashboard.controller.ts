import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Permissions('admin.access')
  @Get()
  get() {
    return this.service.get();
  }
}