import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

const A = 'a'.repeat(40);
const R = 'r'.repeat(40);

describe('AuthService', () => {
  let user: any;
  let svc: AuthService;
  const jwt = new JwtService({});

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = A;
    process.env.JWT_REFRESH_SECRET = R;
    user = {
      id: 'u1',
      login: 'admin',
      status: 'active',
      passwordHash: await argon2.hash('Correct-Horse-1'),
    };
  });

  beforeEach(() => {
    const prisma: any = {
      user: {
        findFirst: async () => user,
        findUnique: async () => user,
        update: async () => user,
      },
    };
    svc = new AuthService(prisma, jwt);
  });

  it('логін з правильним паролем видає токени', async () => {
    const t = await svc.login('admin', 'Correct-Horse-1');
    expect((await jwt.verifyAsync(t.accessToken, { secret: A })).typ).toBe('access');
    expect((await jwt.verifyAsync(t.refreshToken, { secret: R })).typ).toBe('refresh');
  });

  it('неправильний пароль відхиляється', async () => {
    await expect(svc.login('admin', 'nope')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('неактивний користувач відхиляється', async () => {
    user = { ...user, status: 'blocked' };
    await expect(svc.login('admin', 'Correct-Horse-1')).rejects.toBeInstanceOf(UnauthorizedException);
    user = { ...user, status: 'active' };
  });

  it('refresh не приймає access-токен та підроблений токен', async () => {
    const t = await svc.login('admin', 'Correct-Horse-1');
    await expect(svc.refresh(t.accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
    const forged = await jwt.signAsync({ sub: 'u1', typ: 'refresh' }, { secret: 'x'.repeat(40) });
    await expect(svc.refresh(forged)).rejects.toBeInstanceOf(UnauthorizedException);
    const ok = await svc.refresh(t.refreshToken);
    expect(ok.accessToken).toBeTruthy();
  });

  it('refresh-токен без typ (старий формат) відхиляється', async () => {
    const legacy = await jwt.signAsync({ sub: 'u1' }, { secret: R });
    await expect(svc.refresh(legacy)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
