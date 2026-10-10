import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('knowledge/categories')
export class CategoriesController {
  constructor(private service: CategoriesService) {}

  @Permissions('knowledge.view')
  @Get()
  list(@Query('archived') archived?: string) {
    return this.service.list(archived === '1');
  }

  @Permissions('knowledge.manage_categories')
  @Post()
  create(@Req() req: any, @Body() dto: CreateCategoryDto) {
    return this.service.create(req.user.id, dto);
  }

  @Permissions('knowledge.manage_categories')
  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.service.update(req.user.id, id, dto);
  }

  @Permissions('knowledge.manage_categories')
  @Patch(':id/move')
  move(@Param('id') id: string, @Body('direction') direction: string) {
    return this.service.move(id, direction);
  }

  @Permissions('knowledge.manage_categories')
  @Patch(':id/restore')
  restore(@Req() req: any, @Param('id') id: string) {
    return this.service.restore(req.user.id, id);
  }

  @Permissions('knowledge.manage_categories')
  @Delete(':id')
  archive(@Req() req: any, @Param('id') id: string) {
    return this.service.archive(req.user.id, id);
  }
}