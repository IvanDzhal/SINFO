import { signingSecret } from '../../config/secrets';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { Actor } from '../helpers';
import { ItemsService } from '../items/items.service';
import { validateFile, type UploadedFileData } from './file-rules';
import { StorageService } from './storage.service';

const LINK_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class FilesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private items: ItemsService,
  ) {}

  // Термін дії округлюється до години: посилання на файл не змінюється впродовж години,
  // тож браузер кешує фото й не качає його заново при кожному відкритті статті
  private expiry() {
    return (Math.floor(Date.now() / LINK_TTL_MS) + 2) * LINK_TTL_MS;
  }

  private sign(id: string, exp: number) {
    return createHmac('sha256', signingSecret())
      .update(`file:${id}:${exp}`)
      .digest('hex');
  }

  private async find(id: string) {
    const file = await this.prisma.knowledgeFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('Файл не знайдено');
    return file;
  }

  async upload(user: Actor, file: UploadedFileData) {
    const { rule, ext, name } = validateFile(file);
    const id = randomUUID();
    const key = `knowledge/${new Date().getFullYear()}/${id}.${ext}`;

    await this.storage.put(key, file.buffer, rule.mime);
    const rec = await this.prisma.knowledgeFile.create({
      data: {
        id,
        key,
        originalName: name,
        mimeType: rule.mime,
        size: file.size,
        kind: rule.kind,
        uploadedById: user.id,
      },
    });
    return {
      id: rec.id,
      name: rec.originalName,
      mime: rec.mimeType,
      size: rec.size,
      kind: rec.kind,
      url: `sinfo://file/${rec.id}`,
    };
  }

  // Видає тимчасове посилання лише тому, хто має доступ до статті
  async link(user: Actor, id: string) {
    const file = await this.find(id);
    const allowed = file.itemId
      ? await this.items.canAccess(user, file.itemId)
      : file.uploadedById === user.id;
    if (!allowed) throw new ForbiddenException('Немає доступу до файлу');

    const exp = this.expiry();
    return { url: `/knowledge/files/${id}/raw?exp=${exp}&sig=${this.sign(id, exp)}` };
  }

  // Посилання одразу на всі файли статті (один запит замість окремого на кожне фото)
  async links(user: Actor, ids: string[]) {
    const unique = [...new Set(ids)].filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 100);
    const files = await this.prisma.knowledgeFile.findMany({
      where: { id: { in: unique } },
      select: { id: true, itemId: true, uploadedById: true },
    });
    const access = new Map<string, boolean>();
    const urls: Record<string, string> = {};
    for (const f of files) {
      let ok: boolean;
      if (f.itemId) {
        if (!access.has(f.itemId)) access.set(f.itemId, await this.items.canAccess(user, f.itemId));
        ok = access.get(f.itemId) as boolean;
      } else {
        ok = f.uploadedById === user.id;
      }
      if (!ok) continue;
      const exp = this.expiry();
      urls[f.id] = `/knowledge/files/${f.id}/raw?exp=${exp}&sig=${this.sign(f.id, exp)}`;
    }
    return { urls };
  }

  // Підписане посилання без перевірки доступу: викликати лише після власної перевірки прав
  rawUrl(id: string, inline = false) {
    const exp = this.expiry();
    return `/knowledge/files/${id}/raw?exp=${exp}&sig=${this.sign(id, exp)}${inline ? '&inline=1' : ''}`;
  }

  async open(id: string, exp: string, sig: string) {
    const expNum = Number(exp);
    const expected = this.sign(id, expNum);
    const valid =
      !!sig &&
      Number.isFinite(expNum) &&
      sig.length === expected.length &&
      timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!valid) throw new ForbiddenException('Невірне посилання');
    if (expNum < Date.now()) throw new ForbiddenException('Посилання застаріло');

    const file = await this.find(id);
    const stream = await this.storage.get(file.key);
    return { file, stream };
  }
}