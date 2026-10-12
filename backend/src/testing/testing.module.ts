import { Module } from '@nestjs/common';
import { TestingController } from './testing.controller';
import { TestsService } from './tests.service';

@Module({ controllers: [TestingController], providers: [TestsService] })
export class TestingModule {}