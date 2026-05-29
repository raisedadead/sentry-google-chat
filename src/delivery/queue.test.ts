import { describe, expect, it, vi } from 'vitest';
import type { GoogleChatMessage } from '../gchat/card.js';
import type { DeliveryResult } from '../gchat/client.js';
import { DeliveryQueue, type DeliverFn } from './queue.js';

const msg: GoogleChatMessage = {
  fallbackText: 'hi',
  cardsV2: [{ cardId: 'sentry-alert', card: { sections: [{ widgets: [] }] } }],
};

const ok: DeliveryResult = { ok: true, status: 200, retryable: false };
const retryable: DeliveryResult = { ok: false, status: 503, retryable: true };

function virtualClock() {
  let clock = 0;
  return {
    now: () => clock,
    sleep: vi.fn((ms: number) => {
      clock += ms;
      return Promise.resolve();
    }),
  };
}

function makeQueue(deliver: DeliverFn, opts: Record<string, unknown> = {}) {
  const clock = virtualClock();
  const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const queue = new DeliveryQueue({ deliver, now: clock.now, sleep: clock.sleep, logger, ...opts });
  return { queue, sleep: clock.sleep, logger };
}

describe('DeliveryQueue', () => {
  it('delivers a job once on success', async () => {
    const deliver = vi.fn<DeliverFn>(() => Promise.resolve(ok));
    const { queue } = makeQueue(deliver);
    expect(queue.enqueue({ webhookUrl: 'u', message: msg, requestId: 'r1' })).toBe(true);
    await queue.drain();
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver).toHaveBeenCalledWith('u', msg);
  });

  it('drops duplicate request ids (idempotency)', async () => {
    const deliver = vi.fn<DeliverFn>(() => Promise.resolve(ok));
    const { queue } = makeQueue(deliver);
    expect(queue.enqueue({ webhookUrl: 'u', message: msg, requestId: 'r1' })).toBe(true);
    expect(queue.enqueue({ webhookUrl: 'u', message: msg, requestId: 'r1' })).toBe(false);
    await queue.drain();
    expect(deliver).toHaveBeenCalledTimes(1);
  });

  it('delivers distinct request ids', async () => {
    const deliver = vi.fn<DeliverFn>(() => Promise.resolve(ok));
    const { queue } = makeQueue(deliver);
    queue.enqueue({ webhookUrl: 'u', message: msg, requestId: 'r1' });
    queue.enqueue({ webhookUrl: 'u', message: msg, requestId: 'r2' });
    await queue.drain();
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  it('retries a retryable failure then succeeds', async () => {
    const deliver = vi.fn<DeliverFn>().mockResolvedValueOnce(retryable).mockResolvedValueOnce(ok);
    const { queue, sleep } = makeQueue(deliver);
    queue.enqueue({ webhookUrl: 'u', message: msg, requestId: 'r1' });
    await queue.drain();
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000]);
  });

  it('honors Retry-After (retryAfterMs) for backoff', async () => {
    const deliver = vi
      .fn<DeliverFn>()
      .mockResolvedValueOnce({ ok: false, status: 429, retryable: true, retryAfterMs: 2000 })
      .mockResolvedValueOnce(ok);
    const { queue, sleep } = makeQueue(deliver);
    queue.enqueue({ webhookUrl: 'u', message: msg, requestId: 'r1' });
    await queue.drain();
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000]);
  });

  it('does not retry a permanent failure and logs it', async () => {
    const deliver = vi.fn<DeliverFn>(() =>
      Promise.resolve({ ok: false, status: 400, retryable: false })
    );
    const { queue, sleep, logger } = makeQueue(deliver);
    queue.enqueue({ webhookUrl: 'u', message: msg, requestId: 'r1' });
    await queue.drain();
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('gives up after maxRetries with exponential backoff', async () => {
    const deliver = vi.fn<DeliverFn>(() => Promise.resolve(retryable));
    const { queue, sleep, logger } = makeQueue(deliver, { maxRetries: 3 });
    queue.enqueue({ webhookUrl: 'u', message: msg, requestId: 'r1' });
    await queue.drain();
    expect(deliver).toHaveBeenCalledTimes(4);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000, 4000]);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('caps the backoff at maxBackoffMs', async () => {
    const deliver = vi.fn<DeliverFn>(() => Promise.resolve(retryable));
    const { queue, sleep } = makeQueue(deliver, { maxRetries: 5, maxBackoffMs: 3000 });
    queue.enqueue({ webhookUrl: 'u', message: msg, requestId: 'r1' });
    await queue.drain();
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000, 3000, 3000, 3000]);
  });

  it('throttles two messages to the same space by minIntervalMs', async () => {
    const deliver = vi.fn<DeliverFn>(() => Promise.resolve(ok));
    const { queue, sleep } = makeQueue(deliver);
    queue.enqueue({ webhookUrl: 'space-a', message: msg, requestId: 'r1' });
    queue.enqueue({ webhookUrl: 'space-a', message: msg, requestId: 'r2' });
    await queue.drain();
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000]);
  });

  it('does not throttle across different spaces', async () => {
    const deliver = vi.fn<DeliverFn>(() => Promise.resolve(ok));
    const { queue, sleep } = makeQueue(deliver);
    queue.enqueue({ webhookUrl: 'space-a', message: msg, requestId: 'r1' });
    queue.enqueue({ webhookUrl: 'space-b', message: msg, requestId: 'r2' });
    await queue.drain();
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(sleep).not.toHaveBeenCalled();
  });
});
