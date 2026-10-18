import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto } from './dto/maintenance.dto';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private service: MaintenanceService) {}

  // публічний: плашку бачать усі, зокрема на сторінці входу
  @Get('active')
  active() {
    return this.service.active();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.maintenance.manage')
  @Get()
  list() {
    return this.service.list();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.maintenance.manage')
  @Post()
  create(@Req() req: any, @Body() dto: CreateMaintenanceDto) {
    return this.service.create(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('admin.maintenance.manage')
  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.id, id);
  }
}
