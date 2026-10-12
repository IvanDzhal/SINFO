import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto, ReorderDto, UpdateQuestionDto } from './dto/question.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('testing/manage')
export class QuestionsController {
  constructor(private service: QuestionsService) {}

  @Permissions('testing.manage_questions')
  @Post('tests/:id/questions')
  create(@Req() req: any, @Param('id') id: string, @Body() dto: CreateQuestionDto) {
    return this.service.create(req.user, id, dto);
  }

  @Permissions('testing.manage_questions')
  @Put('tests/:id/questions/order')
  reorder(@Req() req: any, @Param('id') id: string, @Body() dto: ReorderDto) {
    return this.service.reorder(req.user, id, dto.ids);
  }

  @Permissions('testing.manage_questions')
  @Patch('questions/:qid')
  update(@Req() req: any, @Param('qid') qid: string, @Body() dto: UpdateQuestionDto) {
    return this.service.update(req.user, qid, dto);
  }

  @Permissions('testing.manage_questions')
  @Delete('questions/:qid')
  remove(@Req() req: any, @Param('qid') qid: string) {
    return this.service.remove(req.user, qid);
  }
}