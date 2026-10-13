import { Module } from '@nestjs/common';
import { ItemsModule } from '../knowledge/items/items.module';
import { StorageService } from '../knowledge/files/storage.service';
import { TestingModule } from '../testing/testing.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AvatarService } from './avatar.service';

@Module({
  imports: [ItemsModule, TestingModule],
  controllers: [ProfileController],
  providers: [ProfileService, AvatarService, StorageService],
})
export class ProfileModule {}
