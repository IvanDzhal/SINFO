import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { SyncService } from './sync.service';

const QUEUE = 'datasync';
const TZ = 'Europe/Kyiv';

type JobData = { sourceId?: string; trigger: 'auto' | 'manual' | 'retry'; triggeredById?: string };

// Автоматична синхронізація: щогодини в робочий час + вечірня о 21:05 (коли «за день» повні).
// Повтори контрольовані: 3 спроби з експоненційною паузою (DATA_SYNC §14).
@Injectable()
export class SyncQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(SyncQueueService.name);
  private connection?: IORedis;
  private queue?: Queue<JobData>;
  private worker?: Worker<JobData>;

  constructor(private sync: SyncService) {}

  get enabled() {
    return !!this.queue;
  }

  async onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url || process.env.DATASYNC_DISABLED === '1') {
      this.log.warn('Фонова синхронізація вимкнена (немає REDIS_URL)');
      return;
    }

    try {
      this.connection = new IORedis(url, { maxRetriesPerRequest: null });
      this.connection.on('error', (e) => this.log.error(`Redis: ${e.message}`));

      this.queue = new Queue<JobData>(QUEUE, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      });

      this.worker = new Worker<JobData>(QUEUE, (job) => this.process(job), {
        connection: this.connection,
        concurrency: 1,
      });
      this.worker.on('failed', (job, e) =>
        this.log.warn(`Job ${job?.name} (спроба ${job?.attemptsMade}) не виконано: ${e.message}`),
      );

      await this.queue.upsertJobScheduler(
        'sync-hourly',
        { pattern: '0 9-20 * * *', tz: TZ },
        { name: 'sync-all', data: { trigger: 'auto' } },
      );
      await this.queue.upsertJobScheduler(
        'sync-evening',
        { pattern: '5 21 * * *', tz: TZ },
        { name: 'sync-all', data: { trigger: 'auto' } },
      );
      this.log.log('Розклад синхронізації: щогодини 09–20 та о 21:05 (Київ)');
    } catch (e) {
      this.log.error(`Не вдалося запустити чергу синхронізації: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }

  private async process(job: Job<JobData>) {
    const trigger = job.attemptsMade > 0 ? 'retry' : job.data.trigger;
    if (job.name === 'sync-source' && job.data.sourceId) {
      const run = await this.sync.runSource(job.data.sourceId, {
        trigger,
        triggeredById: job.data.triggeredById,
      });
      return { runId: run.id, status: run.status };
    }
    return this.sync.runAll(trigger, job.data.triggeredById);
  }

  // Усі джерела: у чергу (або відразу, якщо черги немає)
  async enqueueAll(triggeredById?: string) {
    if (!this.queue) {
      void this.sync.runAll('manual', triggeredById);
      return { queued: false };
    }
    await this.queue.add('sync-all', { trigger: 'manual', triggeredById });
    return { queued: true };
  }
}
