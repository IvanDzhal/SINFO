import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { KnowledgeType, Scope } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { ContentAnalyticsService, ContentFilters } from './content.service';

type ContentQuery = {
  regionId?: string;
  storeId?: string;
  search?: string;
  type?: string;
  from?: string;
  to?: string;
};

function parseDate(v: string | undefined, label: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`Некоректна дата: ${label}`);
  return d;
}

function filters(q: ContentQuery): ContentFilters {
  const types: string[] = Object.values(KnowledgeType);
  if (q.type && !types.includes(q.type)) throw new BadRequestException('Невідомий тип матеріалу');
  const from = parseDate(q.from, 'from');
  const to = parseDate(q.to, 'to');
  if (from && to && from > to) throw new BadRequestException('Початок періоду пізніше за кінець');
  return {
    regionId: q.regionId || undefined,
    storeId: q.storeId || undefined,
    search: q.search?.trim() || undefined,
    type: q.type as KnowledgeType | undefined,
    from,
    to,
  };
}

// Scope береться з права, що відкрило доступ до ендпоінта (його визначає PermissionsGuard)
const scopesOf = (req: any, code: string): Scope[] => req.access?.[code] ?? [];

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('analytics/content')
export class ContentAnalyticsController {
  constructor(private service: ContentAnalyticsService) {}

  @Permissions('analytics.content.view')
  @Get('overview')
  overview(@Req() req: any, @Query() q: ContentQuery) {
    return this.service.overview(req.user, scopesOf(req, 'analytics.content.view'), filters(q));
  }

  @Permissions('analytics.content.view')
  @Get('regions')
  regions(@Req() req: any, @Query() q: ContentQuery) {
    return this.service.regions(req.user, scopesOf(req, 'analytics.content.view'), filters(q));
  }

  @Permissions('analytics.content.view')
  @Get('stores')
  stores(@Req() req: any, @Query() q: ContentQuery) {
    return this.service.stores(req.user, scopesOf(req, 'analytics.content.view'), filters(q));
  }

  @Permissions('analytics.content.view')
  @Get('materials')
  materials(@Req() req: any, @Query() q: ContentQuery) {
    return this.service.materials(req.user, scopesOf(req, 'analytics.content.view'), filters(q));
  }

  @Permissions('analytics.content.view_employee')
  @Get('sellers')
  sellers(@Req() req: any, @Query() q: ContentQuery) {
    return this.service.sellers(
      req.user,
      scopesOf(req, 'analytics.content.view_employee'),
      filters(q),
    );
  }

  @Permissions('analytics.content.view_employee')
  @Get('sellers/:userId/unviewed')
  unviewed(@Req() req: any, @Param('userId') userId: string, @Query() q: ContentQuery) {
    return this.service.unviewed(
      req.user,
      scopesOf(req, 'analytics.content.view_employee'),
      userId,
      filters(q),
    );
  }
}
