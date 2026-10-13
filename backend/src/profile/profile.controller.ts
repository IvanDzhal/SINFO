import {
  BadRequestException,
  Controller,
  Delete,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { UploadedFileData } from '../knowledge/files/file-rules';
import { AvatarService } from './avatar.service';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private service: ProfileService, private avatars: AvatarService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  me(@Req() req: any) {
    return this.service.get(req.user, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('ranking')
  ranking(@Req() req: any) {
    return this.service.ranking(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('avatar-link')
  avatarLink(@Req() req: any) {
    return this.avatars.linkFor(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadAvatar(@Req() req: any, @UploadedFile() file: UploadedFileData) {
    if (!file) throw new BadRequestException('Файл не передано');
    return this.avatars.upload(req.user.id, file);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('avatar')
  removeAvatar(@Req() req: any) {
    return this.avatars.remove(req.user.id);
  }

  // Без JWT: доступ лише за підписаним посиланням
  @Get('avatar/:userId')
  async avatar(
    @Param('userId') userId: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ) {
    const { mime, stream } = await this.avatars.open(userId, exp, sig);
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  byId(@Req() req: any, @Param('id') id: string) {
    return this.service.get(req.user, id);
  }
}
