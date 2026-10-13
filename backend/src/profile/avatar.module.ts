import { Global, Module } from '@nestjs/common';
import { StorageService } from '../knowledge/files/storage.service';
import { AvatarService } from './avatar.service';
import { ProfileAccessService } from './profile-access.service';

// Глобальний, щоб будь-який модуль міг віддавати avatarUrl і перевіряти доступ до профілю
@Global()
@Module({
  providers: [AvatarService, StorageService, ProfileAccessService],
  exports: [AvatarService, ProfileAccessService],
})
export class AvatarModule {}
