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

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, RegionsModule, CitiesModule, BrandsModule, StoresModule, PermissionsModule, RolesModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
