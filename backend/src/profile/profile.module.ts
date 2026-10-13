import { Module } from '@nestjs/common';
import { ItemsModule } from '../knowledge/items/items.module';
import { TestingModule } from '../testing/testing.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [ItemsModule, TestingModule],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
