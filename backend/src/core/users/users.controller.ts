import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard as AccessGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { UsersService } from './users.service';
import {
  ChangeLoginDto,
  CreateUserDto,
  ResetPasswordDto,
  SetManagedRegionsDto,
  SetUserRolesDto,
  UpdateUserDto,
} from './dto/user.dto';

@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('core/users')
export class UsersController {
  constructor(private service: UsersService) {}

  @Permissions('core.users.view')
  @Get()
  list(
    @Query('status') status?: string,
    @Query('roleId') roleId?: string,
    @Query('regionId') regionId?: string,
    @Query('storeId') storeId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.list({ status, roleId, regionId, storeId, search });
  }

  @Permissions('core.users.view')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Permissions('core.users.create')
  @Post()
  create(@Req() req: any, @Body() dto: CreateUserDto) {
    return this.service.create(req.user.id, dto);
  }

  @Permissions('core.users.edit')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(req.user.id, id, dto);
  }

  @Permissions('core.users.deactivate')
  @Patch(':id/deactivate')
  deactivate(@Req() req: any, @Param('id') id: string) {
    return this.service.setStatus(req.user.id, id, 'inactive');
  }

  @Permissions('core.users.deactivate')
  @Patch(':id/activate')
  activate(@Req() req: any, @Param('id') id: string) {
    return this.service.setStatus(req.user.id, id, 'active');
  }

  @Permissions('core.users.reset_password')
  @Patch(':id/reset-password')
  resetPassword(@Req() req: any, @Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.service.resetPassword(req.user.id, id, dto);
  }

  @Permissions('core.users.change_login')
  @Patch(':id/login')
  changeLogin(@Req() req: any, @Param('id') id: string, @Body() dto: ChangeLoginDto) {
    return this.service.changeLogin(req.user.id, id, dto);
  }

  @Permissions('core.users.manage_roles')
  @Patch(':id/roles')
  setRoles(@Req() req: any, @Param('id') id: string, @Body() dto: SetUserRolesDto) {
    return this.service.setRoles(req.user.id, id, dto);
  }

  @Permissions('core.users.manage_roles')
  @Patch(':id/managed-regions')
  setManagedRegions(@Req() req: any, @Param('id') id: string, @Body() dto: SetManagedRegionsDto) {
    return this.service.setManagedRegions(req.user.id, id, dto);
  }
}