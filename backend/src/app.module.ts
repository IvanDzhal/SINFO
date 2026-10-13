import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { RegionsModule } from './core/regions/regions.module';
import { CitiesModule } from './core/cities/cities.module';
import { BrandsModule } from './core/brands/brands.module';
import { StoresModule } from './core/stores/stores.module';
import { PermissionsModule } from './core/permissions/permissions.module';
import { RolesModule } from './core/roles/roles.module';
import { UsersModule } from './core/users/users.module';
import { DashboardModule } from './admin/dashboard.module';
import { PresenceModule } from './presence/presence.module';
import { CategoriesModule } from './knowledge/categories/categories.module';
import { ItemsModule } from './knowledge/items/items.module';
import { ManageModule } from './knowledge/manage/manage.module';
import { FilesModule } from './knowledge/files/files.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TestingModule } from './testing/testing.module';
import { ProfileModule } from './profile/profile.module';
import { AvatarModule } from './profile/avatar.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { DataSyncModule } from './datasync/datasync.module';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, RegionsModule, CitiesModule, BrandsModule, StoresModule, PermissionsModule, RolesModule, UsersModule, DashboardModule, PresenceModule, CategoriesModule, ItemsModule, ManageModule, FilesModule, NotificationsModule, TestingModule, ProfileModule, AvatarModule, AnalyticsModule, DataSyncModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
