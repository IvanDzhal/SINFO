import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { KnowledgeType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { ItemsService } from './items.service';
import { ItemKeyPipe } from '../item-key.pipe';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('knowledge/items')
export class ItemsController {
  constructor(private service: ItemsService) {}

  @Permissions('knowledge.view')
  @Get('latest')
  latest(@Req() req: any, @Query('limit') limit?: string, @Query('type') type?: string) {
    return this.service.latest(req.user, Number(limit) || 6, type);
  }

  @Permissions('knowledge.view')
  @Get('category-counts')
  categoryCounts(@Req() req: any, @Query('type') type?: string) {
    return this.service.categoryCounts(req.user, type);
  }

  @Permissions('knowledge.view')
  @Get()
  list(@Req() req: any, @Query('type') type?: string) {
    if (!type || !(Object.values(KnowledgeType) as string[]).includes(type)) {
      throw new BadRequestException('Невірний тип');
    }
    return this.service.list(req.user, type as KnowledgeType);
  }

  @Permissions('knowledge.view')
  @Get('search')
  search(@Req() req: any, @Query('q') q?: string) {
    return this.service.search(req.user, q ?? '');
  }

  @Permissions('knowledge.view')
  @Get(':id/similar')
  similar(@Req() req: any, @Param('id', ItemKeyPipe) id: string) {
    return this.service.similar(req.user, id);
  }

  @Permissions('knowledge.view')
  @Get(':id')
  get(@Req() req: any, @Param('id', ItemKeyPipe) id: string) {
    return this.service.get(req.user, id);
  }

  @Permissions('knowledge.view')
  @Post(':id/read')
  markRead(@Req() req: any, @Param('id', ItemKeyPipe) id: string, @Body('token') token: string) {
    return this.service.markRead(req.user, id, token);
  }

  @Permissions('knowledge.view_versions')
  @Get(':id/versions')
  versions(@Req() req: any, @Param('id', ItemKeyPipe) id: string) {
    return this.service.versions(req.user, id);
  }

  @Permissions('knowledge.view_versions')
  @Get(':id/versions/:version')
  version(@Req() req: any, @Param('id', ItemKeyPipe) id: string, @Param('version') version: string) {
    const n = Number(version);
    if (!Number.isInteger(n)) throw new BadRequestException('Невірна версія');
    return this.service.version(req.user, id, n);
  }
}