import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { BrandsService } from './brands.service';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('core/brands')
export class BrandsController {
  constructor(private service: BrandsService) {}

  @Permissions('core.brands.view')
  @Get()
  list(@Query('status') status?: string) {
    return this.service.list(status);
  }

  @Permissions('core.brands.view')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Permissions('core.brands.create')
  @Post()
  create(@Req() req: any, @Body() dto: CreateBrandDto) {
    return this.service.create(req.user.id, dto);
  }

  @Permissions('core.brands.edit')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.service.update(req.user.id, id, dto);
  }
}