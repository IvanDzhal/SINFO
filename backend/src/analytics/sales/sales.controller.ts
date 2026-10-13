import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Scope } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { SalesAnalyticsService, SalesFilters } from './sales.service';

class UpdateMetricDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() shortName?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) displayOrder?: number;
  @IsOptional() @IsObject() thresholds?: Record<string, unknown>;
}

type SalesQuery = {
  month?: string;
  asOf?: string;
  regionId?: string;
  cityId?: string;
  storeId?: string;
};

const filters = (q: SalesQuery): SalesFilters => ({
  month: q.month || undefined,
  asOf: q.asOf || undefined,
  regionId: q.regionId || undefined,
  cityId: q.cityId || undefined,
  storeId: q.storeId || undefined,
});

const scopesOf = (req: any): Scope[] => req.access?.['analytics.sales.view'] ?? [];

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('analytics/sales')
export class SalesAnalyticsController {
  constructor(private service: SalesAnalyticsService) {}

  @Permissions('analytics.sales.view')
  @Get('metrics')
  metrics() {
    return this.service.defs();
  }

  @Permissions('analytics.sales.view')
  @Get('periods')
  periods(@Req() req: any) {
    return this.service.periods(req.user, scopesOf(req));
  }

  @Permissions('analytics.sales.view')
  @Get('overview')
  overview(@Req() req: any, @Query() q: SalesQuery) {
    return this.service.overview(req.user, scopesOf(req), filters(q));
  }

  @Permissions('analytics.sales.view')
  @Get('trend')
  trend(@Req() req: any, @Query() q: SalesQuery) {
    return this.service.trend(req.user, scopesOf(req), filters(q));
  }

  @Permissions('analytics.sales.view')
  @Get('year')
  year(@Req() req: any, @Query() q: SalesQuery & { year?: string }) {
    return this.service.year(req.user, scopesOf(req), {
      year: q.year || undefined,
      regionId: q.regionId || undefined,
      storeId: q.storeId || undefined,
    });
  }

  @Permissions('analytics.sales.view')
  @Get('regions')
  regions(@Req() req: any, @Query() q: SalesQuery) {
    return this.service.regions(req.user, scopesOf(req), filters(q));
  }

  @Permissions('analytics.sales.view')
  @Get('stores')
  stores(@Req() req: any, @Query() q: SalesQuery) {
    return this.service.stores(req.user, scopesOf(req), filters(q));
  }

  @Permissions('analytics.sales.view')
  @Get('stores/:id')
  store(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Query() q: SalesQuery) {
    return this.service.store(req.user, scopesOf(req), id, filters(q));
  }

  @Permissions('analytics.sales.view')
  @Get('alerts')
  alerts(@Req() req: any, @Query() q: SalesQuery) {
    return this.service.alerts(req.user, scopesOf(req), filters(q));
  }

  @Permissions('analytics.sales.view')
  @Get('rankings')
  rankings(
    @Req() req: any,
    @Query() q: SalesQuery & { by?: string; metric?: string; level?: string },
  ) {
    const by = q.by ?? 'completion';
    if (!['completion', 'forecast', 'efficiency'].includes(by)) {
      throw new BadRequestException('Невідомий критерій рейтингу');
    }
    const level = q.level ?? 'stores';
    if (!['stores', 'regions'].includes(level)) throw new BadRequestException('Невідомий рівень');
    const metric = q.metric ?? (by === 'efficiency' ? 'SERVICES_EFFICIENCY' : 'TO');
    return this.service.rankings(req.user, scopesOf(req), filters(q), {
      by: by as 'completion' | 'forecast' | 'efficiency',
      metric,
      level: level as 'stores' | 'regions',
    });
  }

  // Налаштування метрик і порогів — функція адміністратора
  @Permissions('admin.access')
  @Patch('metrics/:code')
  updateMetric(@Req() req: any, @Param('code') code: string, @Body() dto: UpdateMetricDto) {
    if (!req.access?.['admin.access']?.includes('GLOBAL')) {
      throw new ForbiddenException('Недостатньо прав');
    }
    return this.service.updateDef(code, dto);
  }
}
