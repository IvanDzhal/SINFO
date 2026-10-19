import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export type PushPayload = { title: string; body?: string; link: string };

// Web Push (Android, desktop і iOS 16.4+ для встановленого PWA).
// Ключі VAPID задаються у змінних середовища; без них push вимкнено, решта порталу працює як раніше.
@Injectable()
export class PushService {
  private log = new Logger('Push');
  private enabled = false;

  constructor(private prisma: PrismaService) {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) {
      this.log.warn('VAPID-ключі не задано: push-сповіщення вимкнено');
      return;
    }
    try {
      webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
      this.enabled = true;
    } catch (e) {
      this.log.error(`Некоректні VAPID-ключі: ${(e as Error).message}`);
    }
  }

  publicKey() {
    return { key: this.enabled ? (process.env.VAPID_PUBLIC_KEY ?? null) : null };
  }

  async subscribe(
    userId: string,
    sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } },
    userAgent?: string,
  ) {
    const endpoint = sub?.endpoint;
    const p256dh = sub?.keys?.p256dh;
    const auth = sub?.keys?.auth;
    if (!endpoint || !p256dh || !auth || !/^https:\/\//.test(endpoint)) {
      return { ok: false };
    }
    // той самий браузер міг раніше бути підписаний іншим користувачем
    await this.prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId, p256dh, auth, userAgent: userAgent?.slice(0, 200) },
      create: { userId, endpoint, p256dh, auth, userAgent: userAgent?.slice(0, 200) },
    });
    return { ok: true };
  }

  async unsubscribe(userId: string, endpoint?: string) {
    if (!endpoint) return { ok: true };
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return { ok: true };
  }

  async status(userId: string) {
    const count = await this.prisma.pushSubscription.count({ where: { userId } });
    return { enabled: this.enabled, subscriptions: count };
  }

  // Розсилка без очікування: помилка push не повинна ламати створення сповіщення
  sendToUsers(userIds: string[], payload: PushPayload) {
    if (!this.enabled || userIds.length === 0) return;
    this.deliver(userIds, payload).catch((e) => this.log.warn(`Push failed: ${e?.message ?? e}`));
  }

  private async deliver(userIds: string[], payload: PushPayload) {
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds }, user: { status: 'active' } },
    });
    const body = JSON.stringify({
      title: payload.title,
      body: (payload.body ?? '').slice(0, 160),
      link: payload.link,
    });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 24 * 3600 },
          );
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          // 404/410: підписка більше не діє
          if (code === 404 || code === 410) {
            await this.prisma.pushSubscription.deleteMany({ where: { id: s.id } });
          }
        }
      }),
    );
  }
}
