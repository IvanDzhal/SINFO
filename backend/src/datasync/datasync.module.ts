import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DataSyncController } from './datasync.controller';
import { GoogleSheetsConnector } from './connector';
import { SourcesService } from './sources.service';
import { SyncService } from './sync.service';
import { SyncQueueService } from './queue.service';

@Module({
  imports: [AuditModule],
  controllers: [DataSyncController],
  providers: [GoogleSheetsConnector, SyncService, SourcesService, SyncQueueService],
  exports: [SyncService],
})
export class DataSyncModule {}
