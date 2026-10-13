import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { SourcesService } from './sources.service';
import { SyncService } from './sync.service';
import { SyncQueueService } from './queue.service';
import { SyncError } from './connector';

class CreateSourceDto {
  @IsUUID() storeId!: string;
  @IsString() externalId!: string;
  @IsOptional() @IsString() sheetName?: string;
  @IsOptional() @IsUUID() copyFromSourceId?: string;
}

class UpdateSourceDto {
  @IsOptional() @IsString() externalId?: string;
  @IsOptional() @IsString() sheetName?: string | null;
  @IsOptional() @IsIn(['active', 'inactive']) status?: string;
}

class MappingDto {
  @IsString() key!: string;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) cells!: string[];
}

class SetMappingsDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => MappingDto) mappings!: MappingDto[];
}

class CopyDto {
  @IsUUID() fromSourceId!: string;
}

// Data Sync — функція адміністратора: потрібен GLOBAL-доступ до відповідного права
function requireGlobal(req: any, code: string) {
  if (!req.access?.[code]?.includes('GLOBAL')) throw new ForbiddenException('Недостатньо прав');
}

// Помилки читання таблиці (немає доступу, немає ключа) віддаємо як зрозуміле 400
function asBadRequest(e: unknown): never {
  if (e instanceof SyncError) throw new BadRequestException(e.message);
  throw e;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('datasync')
export class DataSyncController {
  constructor(
    private sources: SourcesService,
    private sync: SyncService,
    private queue: SyncQueueService,
  ) {}

  @Permissions('datasync.view')
  @Get('sources')
  list(@Req() req: any) {
    requireGlobal(req, 'datasync.view');
    return this.sources.list();
  }

  @Permissions('datasync.view')
  @Get('sources/:id')
  detail(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    requireGlobal(req, 'datasync.view');
    return this.sources.detail(id);
  }

  @Permissions('datasync.manage')
  @Post('sources')
  create(@Req() req: any, @Body() dto: CreateSourceDto) {
    requireGlobal(req, 'datasync.manage');
    return this.sources.create(req.user.id, dto);
  }

  @Permissions('datasync.manage')
  @Patch('sources/:id')
  update(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSourceDto) {
    requireGlobal(req, 'datasync.manage');
    return this.sources.update(req.user.id, id, dto);
  }

  @Permissions('datasync.manage')
  @Put('sources/:id/mappings')
  setMappings(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMappingsDto,
  ) {
    requireGlobal(req, 'datasync.manage');
    return this.sources.setMappings(req.user.id, id, dto.mappings);
  }

  @Permissions('datasync.manage')
  @Post('sources/:id/mappings/copy')
  copy(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CopyDto) {
    requireGlobal(req, 'datasync.manage');
    return this.sources.copyMappings(req.user.id, id, dto.fromSourceId);
  }

  @Permissions('datasync.manage')
  @Post('sources/:id/preview')
  async preview(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    requireGlobal(req, 'datasync.manage');
    return this.sources.preview(id).catch(asBadRequest);
  }

  @Permissions('datasync.manage')
  @Post('sources/:id/suggest')
  async suggest(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    requireGlobal(req, 'datasync.manage');
    return this.sources.suggest(id).catch(asBadRequest);
  }

  @Permissions('datasync.run')
  @Post('sources/:id/sync')
  async run(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    requireGlobal(req, 'datasync.run');
    return this.sync
      .runSource(id, { trigger: 'manual', triggeredById: req.user.id })
      .catch(asBadRequest);
  }

  @Permissions('datasync.run')
  @Post('sync')
  runAll(@Req() req: any) {
    requireGlobal(req, 'datasync.run');
    return this.queue.enqueueAll(req.user.id);
  }

  @Permissions('datasync.view')
  @Get('runs')
  runs(@Req() req: any, @Query('sourceId') sourceId?: string, @Query('limit') limit?: string) {
    requireGlobal(req, 'datasync.view');
    return this.sources.runs({ sourceId, limit: limit ? Number(limit) : undefined });
  }
}
