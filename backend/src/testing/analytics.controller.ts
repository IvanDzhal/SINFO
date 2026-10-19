import { Body, Controller, Delete, Get, Param, Patch, Query, Req, Res, UseGuards } from '@nestjs/common';
import { xlsxResponse } from '../common/xlsx';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('testing/analytics')
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  @Permissions('testing.view_analytics')
  @Get('summary')
  summary(
    @Req() req: any,
    @Query('testId') testId?: string,
    @Query('storeId') storeId?: string,
    @Query('regionId') regionId?: string,
  ) {
    return this.service.summary(req.user, { testId, storeId, regionId });
  }

  @Permissions('testing.view_analytics')
  @Get('tests')
  tests(@Req() req: any) {
    return this.service.tests(req.user);
  }

  @Permissions('testing.view_analytics')
  @Get('stores')
  stores(@Req() req: any, @Query('testId') testId?: string, @Query('regionId') regionId?: string) {
    return this.service.stores(req.user, { testId, regionId });
  }

  @Permissions('testing.view_analytics')
  @Get('regions')
  regions(@Req() req: any, @Query('testId') testId?: string) {
    return this.service.regions(req.user, { testId });
  }

  @Permissions('testing.view_analytics')
  @Get('users')
  users(
    @Req() req: any,
    @Query('testId') testId?: string,
    @Query('storeId') storeId?: string,
    @Query('regionId') regionId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.users(req.user, { testId, storeId, regionId, search });
  }

  @Permissions('testing.view_analytics')
  @Get('export')
  async export(
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
    @Query('testId') testId?: string,
    @Query('storeId') storeId?: string,
    @Query('regionId') regionId?: string,
    @Query('search') search?: string,
  ) {
    const sheets = await this.service.exportSheets(req.user, { testId, storeId, regionId, search });
    return xlsxResponse(res, 'rezultaty-testiv', sheets);
  }

  @Permissions('testing.view_analytics')
  @Get('questions')
  questions(@Req() req: any, @Query('testId') testId: string) {
    return this.service.questions(req.user, testId);
  }

  @Permissions('testing.view_attempts')
  @Get('users/:userId')
  userResults(@Req() req: any, @Param('userId') userId: string) {
    return this.service.userResults(req.user, userId);
  }

  @Permissions('testing.view_answers')
  @Get('attempts/:attemptId/answers')
  answers(@Req() req: any, @Param('attemptId') attemptId: string) {
    return this.service.attemptAnswers(req.user, attemptId);
  }

  @Permissions('testing.edit_results')
  @Delete('attempts/:attemptId')
  removeAttempt(@Req() req: any, @Param('attemptId') attemptId: string) {
    return this.service.removeAttempt(req.user, attemptId);
  }

  @Permissions('testing.edit_results')
  @Patch('attempts/:attemptId/answers/:questionId')
  setScore(
    @Req() req: any,
    @Param('attemptId') attemptId: string,
    @Param('questionId') questionId: string,
    @Body('score') score: number,
  ) {
    return this.service.setAnswerScore(req.user, attemptId, questionId, score);
  }
}
