import { Module } from '@nestjs/common';
import { ContentAnalyticsController } from './content/content.controller';
import { ContentAnalyticsService } from './content/content.service';
import { SalesAnalyticsController } from './sales/sales.controller';
import { SalesAnalyticsService } from './sales/sales.service';

@Module({
  controllers: [ContentAnalyticsController, SalesAnalyticsController],
  providers: [ContentAnalyticsService, SalesAnalyticsService],
})
export class AnalyticsModule {}
