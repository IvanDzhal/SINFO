import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { RegionsModule } from './core/regions/regions.module';

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, RegionsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
