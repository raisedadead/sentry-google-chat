import type { GoogleChatMessage } from '../gchat/card.js';
import type { DeliveryResult } from '../gchat/client.js';
import { redactWebhookUrl } from '../gchat/client.js';

export type DeliverFn = (webhookUrl: string, message: GoogleChatMessage) => Promise<DeliveryResult>;

export interface DeliveryJob {
  webhookUrl: string;
  message: GoogleChatMessage;
  requestId: string;
}

export interface QueueLogger {
  debug(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface DeliveryQueueOptions {
  deliver: DeliverFn;
  logger?: QueueLogger;
  minIntervalMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  idempotencyTtlMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * In-process, per-space delivery queue. Decouples the sub-1s Sentry webhook ACK
 * from Google Chat's ~1 msg/sec per-space rate limit: callers enqueue and return
 * immediately while messages are serialized per space, throttled, retried with
 * exponential backoff, and deduplicated by Sentry Request-ID. The DeliverFn is
 * injected so the transport can later be swapped for a durable queue.
 */
export class DeliveryQueue {
  private readonly deliver: DeliverFn;
  private readonly logger: QueueLogger | undefined;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly idempotencyTtlMs: number;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  private readonly chains = new Map<string, Promise<void>>();
  private readonly lastSentAt = new Map<string, number>();
  private readonly seen = new Map<string, number>();
  private readonly inflight = new Set<Promise<void>>();

  constructor(options: DeliveryQueueOptions) {
    this.deliver = options.deliver;
    this.logger = options.logger;
    this.minIntervalMs = options.minIntervalMs ?? 1000;
    this.maxRetries = options.maxRetries ?? 5;
    this.baseBackoffMs = options.baseBackoffMs ?? 1000;
    this.maxBackoffMs = options.maxBackoffMs ?? 32_000;
    this.idempotencyTtlMs = options.idempotencyTtlMs ?? 600_000;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
  }

  enqueue(job: DeliveryJob): boolean {
    if (this.isDuplicate(job.requestId)) return false;

    const key = job.webhookUrl;
    const previous = this.chains.get(key) ?? Promise.resolve();
    const task = previous.then(() => this.process(key, job));
    const tracked = task.catch((error: unknown) => {
      this.logger?.error({ error, space: redactWebhookUrl(key) }, 'delivery task crashed');
    });

    this.chains.set(key, tracked);
    this.inflight.add(tracked);
    void tracked.finally(() => this.inflight.delete(tracked));
    return true;
  }

  async drain(): Promise<void> {
    while (this.inflight.size > 0) {
      await Promise.allSettled([...this.inflight]);
    }
  }

  size(): number {
    return this.inflight.size;
  }

  private isDuplicate(requestId: string): boolean {
    const now = this.now();
    for (const [id, expiry] of this.seen) {
      if (expiry <= now) this.seen.delete(id);
    }
    if ((this.seen.get(requestId) ?? 0) > now) return true;
    this.seen.set(requestId, now + this.idempotencyTtlMs);
    return false;
  }

  private async throttleSpace(key: string): Promise<void> {
    const last = this.lastSentAt.get(key);
    if (last === undefined) return;
    const wait = this.minIntervalMs - (this.now() - last);
    if (wait > 0) await this.sleep(wait);
  }

  private async process(key: string, job: DeliveryJob): Promise<void> {
    const space = redactWebhookUrl(key);
    let attempt = 0;

    for (;;) {
      await this.throttleSpace(key);
      const result = await this.deliver(job.webhookUrl, job.message);
      this.lastSentAt.set(key, this.now());

      if (result.ok) {
        this.logger?.debug({ space, requestId: job.requestId }, 'delivered to Google Chat');
        return;
      }
      if (!result.retryable) {
        this.logger?.warn(
          { space, status: result.status, requestId: job.requestId },
          'permanent Google Chat delivery failure; dropping'
        );
        return;
      }
      if (attempt >= this.maxRetries) {
        this.logger?.warn(
          { space, status: result.status, attempts: attempt + 1, requestId: job.requestId },
          'exhausted retries delivering to Google Chat; dropping'
        );
        return;
      }

      const backoff =
        result.retryAfterMs ?? Math.min(this.maxBackoffMs, this.baseBackoffMs * 2 ** attempt);
      await this.sleep(backoff);
      attempt += 1;
    }
  }
}
