import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { KnowledgeType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { ItemsService } from './items.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('knowledge/items')
export class ItemsController {
  constructor(private service: ItemsService) {}

  @Permissions('knowledge.view')
  @Get('latest')
  latest(@Req() req: any, @Query('limit') limit?: string) {
    return this.service.latest(req.user, Number(limit) || 6);
  }

  @Permissions('knowledge.view')
  @Get()
  list(@Req() req: any, @Query('type') type?: string) {
    if (!type || !(Object.values(KnowledgeType) as string[]).includes(type)) {
      throw new BadRequestException('Невірний тип');
    }
    return this.service.list(req.user, type as KnowledgeType);
  }
}