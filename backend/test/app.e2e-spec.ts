import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';

// Перевіряємо HTTP-шар auth без БД: валідація DTO та rate-limit на логіні.
describe('Auth (e2e, без БД)', () => {
  let app: INestApplication<App>;
  const login = jest.fn().mockRejectedValue(new Error('x'));

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }])],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { login, refresh: jest.fn() } }],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });
  afterAll(() => app.close());

  it('відхиляє тіло без полів (400)', () =>
    request(app.getHttpServer()).post('/auth/login').send({}).expect(400));

  it('відхиляє надто довгий пароль (400)', () =>
    request(app.getHttpServer())
      .post('/auth/login')
      .send({ login: 'a', password: 'x'.repeat(500) })
      .expect(400));
});
