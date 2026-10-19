import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { TrashController } from './trash.controller';
import { TrashService } from './trash.service';

@Module({
  controllers: [DashboardController, TrashController],
  providers: [DashboardService, TrashService],
})
export class DashboardModule {}
