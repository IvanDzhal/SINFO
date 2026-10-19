import { slugKeyPipe } from '../common/slug-key';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import type { UploadedFileData } from '../knowledge/files/file-rules';
import { TrainingService } from './training.service';
import {
  CreateLessonDto,
  CreateStageDto,
  ReorderDto,
  UpdateLessonDto,
  UpdateStageDto,
} from './dto/training.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('training')
export class TrainingController {
  constructor(private service: TrainingService) {}

  // ----- співробітник -----
  @Permissions('training.view')
  @Get()
  overview(@Req() req: any) {
    return this.service.overview(req.user);
  }

  @Permissions('training.view_analytics')
  @Get('analytics')
  analytics(@Req() req: any) {
    return this.service.analytics(req.user);
  }

  @Permissions('training.view')
  @Get('lessons/:id')
  lesson(@Req() req: any, @Param('id', slugKeyPipe('trainingLesson')) id: string) {
    return this.service.lesson(req.user, id);
  }

  @Permissions('training.view')
  @Get('lessons/:id/file')
  file(@Req() req: any, @Param('id', slugKeyPipe('trainingLesson')) id: string) {
    return this.service.fileUrl(req.user, id);
  }

  @Permissions('training.view')
  @Post('lessons/:id/complete')
  complete(@Req() req: any, @Param('id', slugKeyPipe('trainingLesson')) id: string) {
    return this.service.complete(req.user, id);
  }

  // ----- CMS (статичні шляхи йдуть раніше за :id) -----
  @Permissions('training.manage')
  @Get('manage/stages')
  manageList() {
    return this.service.manageList();
  }

  @Permissions('training.manage')
  @Get('manage/tests')
  testOptions() {
    return this.service.testOptions();
  }

  @Permissions('training.manage')
  @Post('manage/stages')
  createStage(@Req() req: any, @Body() dto: CreateStageDto) {
    return this.service.createStage(req.user, dto);
  }

  @Permissions('training.manage')
  @Patch('manage/stages/reorder')
  reorderStages(@Body() dto: ReorderDto) {
    return this.service.reorderStages(dto.ids);
  }

  @Permissions('training.manage')
  @Patch('manage/stages/:id')
  updateStage(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateStageDto) {
    return this.service.updateStage(req.user, id, dto);
  }

  @Permissions('training.manage')
  @Post('manage/stages/:id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.service.setStageStatus(req.user, id, 'published');
  }

  @Permissions('training.manage')
  @Post('manage/stages/:id/unpublish')
  unpublish(@Req() req: any, @Param('id') id: string) {
    return this.service.setStageStatus(req.user, id, 'draft');
  }

  @Permissions('training.manage')
  @Post('manage/stages/:id/archive')
  archive(@Req() req: any, @Param('id') id: string) {
    return this.service.setStageStatus(req.user, id, 'archived');
  }

  @Permissions('training.manage')
  @Delete('manage/stages/:id')
  removeStage(@Req() req: any, @Param('id') id: string) {
    return this.service.removeStage(req.user, id);
  }

  @Permissions('training.manage')
  @Post('manage/stages/:id/lessons')
  createLesson(@Req() req: any, @Param('id') id: string, @Body() dto: CreateLessonDto) {
    return this.service.createLesson(req.user, id, dto);
  }

  @Permissions('training.manage')
  @Patch('manage/stages/:id/lessons/reorder')
  reorderLessons(@Param('id') id: string, @Body() dto: ReorderDto) {
    return this.service.reorderLessons(id, dto.ids);
  }

  @Permissions('training.manage')
  @Get('manage/lessons/:id')
  getLesson(@Param('id') id: string) {
    return this.service.getLessonForEdit(id);
  }

  @Permissions('training.manage')
  @Patch('manage/lessons/:id')
  updateLesson(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateLessonDto) {
    return this.service.updateLesson(req.user, id, dto);
  }

  @Permissions('training.manage')
  @Delete('manage/lessons/:id')
  archiveLesson(@Req() req: any, @Param('id') id: string) {
    return this.service.archiveLesson(req.user, id);
  }

  @Permissions('training.manage')
  @Get('manage/lessons/:id/versions')
  versions(@Param('id') id: string) {
    return this.service.versions(id);
  }

  @Permissions('training.manage')
  @Post('manage/lessons/:id/versions/:version/restore')
  restore(
    @Req() req: any,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.service.restoreVersion(req.user, id, version);
  }

  @Permissions('training.manage')
  @Post('manage/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(@Req() req: any, @UploadedFile() file: UploadedFileData) {
    if (!file) throw new BadRequestException('Файл не передано');
    return this.service.uploadPdf(req.user, file);
  }
}
