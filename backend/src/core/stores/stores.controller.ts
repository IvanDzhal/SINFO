import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { StoresService } from './stores.service';
import { CreateStoreDto, UpdateStoreDto } from './dto/store.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('core/stores')
export class StoresController {
  constructor(private service: StoresService) {}

  @Permissions('core.stores.view')
  @Get()
  list(
    @Query('regionId') regionId?: string,
    @Query('cityId') cityId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.list({ regionId, cityId, status });
  }

  @Permissions('core.stores.view')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Permissions('core.stores.create')
  @Post()
  create(@Req() req: any, @Body() dto: CreateStoreDto) {
    return this.service.create(req.user.id, dto);
  }

  @Permissions('core.stores.edit')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.service.update(req.user.id, id, dto);
  }
}