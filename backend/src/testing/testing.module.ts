import { Module } from '@nestjs/common';
import { TestingController } from './testing.controller';
import { QuestionsController } from './questions.controller';
import { TestsService } from './tests.service';
import { QuestionsService } from './questions.service';

@Module({
  controllers: [TestingController, QuestionsController],
  providers: [TestsService, QuestionsService],
})
export class TestingModule {}