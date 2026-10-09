import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/audit-log')
export class AuditController {
  constructor(private service: AuditService) {}

  @Permissions('admin.audit.view')
  @Get()
  list(@Query() query: AuditQueryDto) {
    return this.service.list(query);
  }
}