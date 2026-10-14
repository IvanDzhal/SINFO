import { signingSecret } from '../config/secrets';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../knowledge/files/storage.service';
import { validateFile, type UploadedFileData } from '../knowledge/files/file-rules';

const LINK_TTL_MS = 60 * 60 * 1000;
const MAX_BYTES = 3 * 1024 * 1024;

@Injectable()
export class AvatarService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  private sign(userId: string, exp: number) {
    return createHmac('sha256', signingSecret())
      .update(`avatar:${userId}:${exp}`)
      .digest('hex');
  }

  // Підписане тимчасове посилання на аватарку (img не передає JWT)
  link(user: { id: string; avatarKey: string | null; avatarUpdatedAt: Date | null }) {
    if (!user.avatarKey) return null;
    const exp = Date.now() + LINK_TTL_MS;
    const v = user.avatarUpdatedAt?.getTime() ?? 0;
    return `/profile/avatar/${user.id}?exp=${exp}&sig=${this.sign(user.id, exp)}&v=${v}`;
  }

  async linkFor(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, avatarKey: true, avatarUpdatedAt: true },
    });
    return { url: u ? this.link(u) : null };
  }

  async upload(userId: string, file: UploadedFileData) {
    const { rule, ext } = validateFile(file);
    if (rule.kind !== 'image') {
      throw new BadRequestException('Потрібне зображення: PNG, JPG або WebP');
    }
    if (file.size > MAX_BYTES) throw new BadRequestException('Файл завеликий. Максимум 3 МБ');

    const key = `avatars/${userId}/${randomUUID()}.${ext}`;
    await this.storage.put(key, file.buffer, rule.mime);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: key, avatarMime: rule.mime, avatarUpdatedAt: new Date() },
      select: { id: true, avatarKey: true, avatarUpdatedAt: true },
    });
    return { url: this.link(user) };
  }

  async remove(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: null, avatarMime: null, avatarUpdatedAt: null },
    });
    return { url: null };
  }

  async open(userId: string, exp: string, sig: string) {
    const expNum = Number(exp);
    const expected = this.sign(userId, expNum);
    const valid =
      !!sig &&
      Number.isFinite(expNum) &&
      sig.length === expected.length &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!valid) throw new ForbiddenException('Невірне посилання');
    if (expNum < Date.now()) throw new ForbiddenException('Посилання застаріло');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarKey: true, avatarMime: true },
    });
    if (!user?.avatarKey) throw new NotFoundException('Аватарку не знайдено');
    return { mime: user.avatarMime ?? 'image/png', stream: await this.storage.get(user.avatarKey) };
  }
}
