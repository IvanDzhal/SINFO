import { Module } from '@nestjs/common';
import { TestingController } from './testing.controller';
import { QuestionsController } from './questions.controller';
import { AttemptsController } from './attempts.controller';
import { TestsService } from './tests.service';
import { QuestionsService } from './questions.service';
import { AttemptsService } from './attempts.service';

@Module({
  controllers: [TestingController, QuestionsController, AttemptsController],
  providers: [TestsService, QuestionsService, AttemptsService],
})
export class TestingModule {}