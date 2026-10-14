import { accessSecret, refreshSecret } from '../config/secrets';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

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
    return this.issueTokens(user.id, user.login);
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
      return this.issueTokens(user.id, user.login);
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

  private async issueTokens(sub: string, login: string) {
    return {
      accessToken: await this.jwt.signAsync({ sub, login, typ: 'access' }, {
        secret: accessSecret(),
        expiresIn: '15m',
      }),
      refreshToken: await this.jwt.signAsync({ sub, login, typ: 'refresh' }, {
        secret: refreshSecret(),
        expiresIn: '7d',
      }),
    };
  }
}