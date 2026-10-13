import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { TestingController } from './testing.controller';
import { QuestionsController } from './questions.controller';
import { AttemptsController } from './attempts.controller';
import { AnalyticsController } from './analytics.controller';
import { TestsService } from './tests.service';
import { QuestionsService } from './questions.service';
import { AttemptsService } from './attempts.service';
import { AnalyticsService } from './analytics.service';
import { TestRemindersService } from './reminders.service';

@Module({
  imports: [NotificationsModule],
  controllers: [TestingController, QuestionsController, AttemptsController, AnalyticsController],
  providers: [
    TestsService,
    QuestionsService,
    AttemptsService,
    AnalyticsService,
    TestRemindersService,
  ],
})
export class TestingModule {}