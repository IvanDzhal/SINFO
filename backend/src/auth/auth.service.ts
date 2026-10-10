import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(login: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { login: { equals: login.trim(), mode: 'insensitive' } },
    });
    if (
      !user ||
      user.status !== 'active' ||
      !(await argon2.verify(user.passwordHash, password))
    ) {
      throw new UnauthorizedException('Невірний логін або пароль');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(user.id, user.login);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwt.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
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
    const payload = { sub, login };
    return {
      accessToken: await this.jwt.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      }),
      refreshToken: await this.jwt.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    };
  }
}