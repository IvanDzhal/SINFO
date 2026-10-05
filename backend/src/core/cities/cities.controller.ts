import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { CitiesService } from './cities.service';
import { CreateCityDto, UpdateCityDto } from './dto/city.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('core/cities')
export class CitiesController {
  constructor(private service: CitiesService) {}

  @Permissions('core.cities.view')
  @Get()
  list(@Query('regionId') regionId?: string) {
    return this.service.list(regionId);
  }

  @Permissions('core.cities.view')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Permissions('core.cities.create')
  @Post()
  create(@Req() req: any, @Body() dto: CreateCityDto) {
    return this.service.create(req.user.id, dto);
  }

  @Permissions('core.cities.edit')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.service.update(req.user.id, id, dto);
  }
}