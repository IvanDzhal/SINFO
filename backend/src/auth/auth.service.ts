import { accessSecret, refreshSecret } from '../config/secrets';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// «Версія» пароля в токені: змінився пароль, і всі раніше видані токени стають недійсними
export const pwVersion = (hash: string) =>
  createHash('sha256').update(hash).digest('hex').slice(0, 12);

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(login: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { login: { equals: login.trim(), mode: 'insensitive' } },
    });
    // Хеш перевіряємо завжди — однаковий час відповіді для неіснуючого логіна
    const hash = user?.passwordHash ?? (await this.dummyHash());
    const ok = await argon2.verify(hash, password);
    if (!user || user.status !== 'active' || !ok) {
      throw new UnauthorizedException('Невірний логін або пароль');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(user.id, user.login, user.passwordHash);
  }

  private dummy?: Promise<string>;
  private dummyHash() {
    return (this.dummy ??= argon2.hash(randomBytes(16).toString('hex')));
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: refreshSecret(),
      });
      if (payload.typ !== 'refresh') throw new Error();
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.status !== 'active') throw new Error();
      // токени без pv видані до цього оновлення: приймаємо, наступний refresh уже буде з pv
      if (payload.pv && payload.pv !== pwVersion(user.passwordHash)) throw new Error();
      return this.issueTokens(user.id, user.login, user.passwordHash);
    } catch {
      throw new UnauthorizedException('Недійсний refresh token');
    }
  }

  async permissionsOf(userId: string) {
    const rows = await this.prisma.rolePermission.findMany({
      where: { role: { archivedAt: null, users: { some: { userId } } } },
      include: { permission: true },
    });
    return [...new Set(rows.map((r) => r.permission.code))];
  }

  private async issueTokens(sub: string, login: string, passwordHash: string) {
    const pv = pwVersion(passwordHash);
    return {
      accessToken: await this.jwt.signAsync({ sub, login, pv, typ: 'access' }, {
        secret: accessSecret(),
        expiresIn: '15m',
      }),
      refreshToken: await this.jwt.signAsync({ sub, login, pv, typ: 'refresh' }, {
        secret: refreshSecret(),
        expiresIn: '7d',
      }),
    };
  }
}