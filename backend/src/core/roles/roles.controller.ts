import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard as AccessGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { RolesService } from './roles.service';
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/role.dto';

@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('core/roles')
export class RolesController {
  constructor(private service: RolesService) {}

  @Permissions('core.roles.view')
  @Get()
  list() {
    return this.service.list();
  }

  @Permissions('core.roles.view')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Permissions('core.roles.create')
  @Post()
  create(@Req() req: any, @Body() dto: CreateRoleDto) {
    return this.service.create(req.user.id, dto);
  }

  @Permissions('core.roles.create')
  @Post(':id/copy')
  copy(@Req() req: any, @Param('id') id: string, @Body('name') name: string) {
    return this.service.copy(req.user.id, id, name);
  }

  @Permissions('core.roles.edit')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.service.update(req.user.id, id, dto);
  }

  @Permissions('core.roles.edit')
  @Patch(':id/permissions')
  setPermissions(@Req() req: any, @Param('id') id: string, @Body() dto: SetRolePermissionsDto) {
    return this.service.setPermissions(req.user.id, id, dto);
  }

  @Permissions('core.roles.archive')
  @Delete(':id')
  archive(@Req() req: any, @Param('id') id: string) {
    return this.service.archive(req.user.id, id);
  }
}