import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { RegionsService } from './regions.service';
import { CreateRegionDto, UpdateRegionDto } from './dto/region.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('core/regions')
export class RegionsController {
  constructor(private service: RegionsService) {}

  @Permissions('core.regions.view')
  @Get()
  list(@Query('status') status?: string) {
    return this.service.list(status);
  }

  @Permissions('core.regions.view')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Permissions('core.regions.create')
  @Post()
  create(@Req() req: any, @Body() dto: CreateRegionDto) {
    return this.service.create(req.user.id, dto);
  }

  @Permissions('core.regions.edit')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateRegionDto) {
    return this.service.update(req.user.id, id, dto);
  }
}