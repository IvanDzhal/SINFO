import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { assertSecrets, corsOrigins } from './config/secrets';

async function bootstrap() {
  assertSecrets();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // за ланцюгом reverse proxy (nginx → caddy → backend): довіряємо приватним мережам,
  // тож req.ip = перша публічна адреса в X-Forwarded-For (справжній клієнт, потрібен throttler)
  app.set('trust proxy', 'loopback, linklocal, uniquelocal');
  // стандартний ліміт Express (100 КБ) замалий для великих статей; файли йдуть окремо, через multipart
  app.useBodyParser('json', { limit: '10mb' });
  app.enableShutdownHooks();
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  app.enableCors({ origin: corsOrigins() });
  await app.listen(3000);
}
void bootstrap();
