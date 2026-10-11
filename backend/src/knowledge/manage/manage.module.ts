import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../notifications/notifications.module';
import { ManageController } from './manage.controller';
import { ManageService } from './manage.service';

@Module({
  imports: [NotificationsModule],
  controllers: [ManageController],
  providers: [ManageService],
})
export class ManageModule {}