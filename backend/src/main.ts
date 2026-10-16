import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { assertSecrets, corsOrigins } from './config/secrets';

async function bootstrap() {
  assertSecrets();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // за reverse proxy: справжній IP клієнта потрібен для throttler
  app.set('trust proxy', 1);
  app.enableShutdownHooks();
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({ origin: corsOrigins() });
  await app.listen(3000);
}
void bootstrap();
