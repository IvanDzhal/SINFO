import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SlugBackfill } from '../common/slug-key';

@Global()
@Module({ providers: [PrismaService, SlugBackfill], exports: [PrismaService] })
export class PrismaModule {}