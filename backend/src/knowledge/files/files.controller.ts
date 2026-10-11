import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { FilesService } from './files.service';
import type { UploadedFileData } from './file-rules';

const encodeName = (name: string) =>
  encodeURIComponent(name).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

@Controller('knowledge/files')
export class FilesController {
  constructor(private service: FilesService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('knowledge.manage_files')
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(@Req() req: any, @UploadedFile() file: UploadedFileData) {
    if (!file) throw new BadRequestException('Файл не передано');
    return this.service.upload(req.user, file);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/link')
  link(@Req() req: any, @Param('id') id: string) {
    return this.service.link(req.user, id);
  }

  // Без JWT: доступ лише за підписаним посиланням, яке видає /link
  @Get(':id/raw')
  async raw(
    @Param('id') id: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const { file, stream } = await this.service.open(id, exp, sig);
    const disposition = file.kind === 'image' ? 'inline' : 'attachment';
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', String(file.size));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encodeName(file.originalName)}`,
    );
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }
}