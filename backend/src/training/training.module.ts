import { Module } from '@nestjs/common';
import { FilesModule } from '../knowledge/files/files.module';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';

@Module({
  imports: [FilesModule],
  controllers: [TrainingController],
  providers: [TrainingService],
})
export class TrainingModule {}
