import { Global, Module } from '@nestjs/common';
import { StorageService } from '../knowledge/files/storage.service';
import { AvatarService } from './avatar.service';

// Глобальний, щоб будь-який модуль міг віддавати avatarUrl разом із користувачем
@Global()
@Module({ providers: [AvatarService, StorageService], exports: [AvatarService] })
export class AvatarModule {}
