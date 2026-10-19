import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { AttemptsService } from './attempts.service';
import { AnswerDto } from './dto/answer.dto';
import { slugKeyPipe } from '../common/slug-key';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('testing')
export class AttemptsController {
  constructor(private service: AttemptsService) {}

  @Permissions('testing.view')
  @Get('tests/:id')
  detail(@Req() req: any, @Param('id', slugKeyPipe('test')) id: string) {
    return this.service.detail(req.user, id);
  }

  @Permissions('testing.start')
  @Post('tests/:id/start')
  start(@Req() req: any, @Param('id', slugKeyPipe('test')) id: string) {
    return this.service.start(req.user, id);
  }

  @Permissions('testing.view')
  @Get('attempts/:attemptId')
  get(@Req() req: any, @Param('attemptId') attemptId: string) {
    return this.service.get(req.user, attemptId);
  }

  @Permissions('testing.start')
  @Put('attempts/:attemptId/answers/:questionId')
  saveAnswer(
    @Req() req: any,
    @Param('attemptId') attemptId: string,
    @Param('questionId') questionId: string,
    @Body() dto: AnswerDto,
  ) {
    return this.service.saveAnswer(req.user, attemptId, questionId, dto.answer);
  }

  @Permissions('testing.start')
  @Post('attempts/:attemptId/finish')
  finish(@Req() req: any, @Param('attemptId') attemptId: string) {
    return this.service.finish(req.user, attemptId);
  }
}