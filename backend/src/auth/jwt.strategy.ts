import { accessSecret } from '../config/secrets';
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: accessSecret(),
    });
  }

  async validate(payload: { sub: string; typ?: string }) {
    if (payload.typ !== 'access') return null;
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { managedRegions: true },
    });
    if (!user || user.status !== 'active') return null;
    const { passwordHash, managedRegions, ...safe } = user;
    return { ...safe, managedRegionIds: managedRegions.map((m) => m.regionId) };
  }
}