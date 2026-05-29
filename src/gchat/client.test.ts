import { describe, expect, it, vi } from 'vitest';
import type { GoogleChatMessage } from './card.js';
import { postToSpace, redactWebhookUrl } from './client.js';

const url = 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=secret-key&token=secret-token';

function message(withThread = true): GoogleChatMessage {
  return {
    fallbackText: 'hi',
    cardsV2: [{ cardId: 'sentry-alert', card: { sections: [{ widgets: [] }] } }],
    ...(withThread ? { thread: { threadKey: 'issue_alert:1' } } : {}),
  };
}

function jsonResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(status === 200 ? '{}' : 'error', { status, headers });
}

function mockFetch(response: Response) {
  return vi.fn<typeof fetch>(() => Promise.resolve(response));
}

describe('postToSpace', () => {
  it('returns ok on 200', async () => {
    const result = await postToSpace(url, message(), { fetchImpl: mockFetch(jsonResponse(200)) });
    expect(result).toEqual({ ok: true, status: 200, retryable: false });
  });

  it('sends a POST with JSON body containing the card', async () => {
    const fetchImpl = mockFetch(jsonResponse(200));
    await postToSpace(url, message(), { fetchImpl });
    const init = fetchImpl.mock.calls[0]![1]!;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
    expect(init.body as string).toContain('cardsV2');
  });

  it('appends messageReplyOption when the message is threaded', async () => {
    const fetchImpl = mockFetch(jsonResponse(200));
    await postToSpace(url, message(true), { fetchImpl });
    expect(fetchImpl.mock.calls[0]![0] as string).toContain(
      'messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD'
    );
  });

  it('does not append messageReplyOption when unthreaded', async () => {
    const fetchImpl = mockFetch(jsonResponse(200));
    await postToSpace(url, message(false), { fetchImpl });
    expect(fetchImpl.mock.calls[0]![0] as string).not.toContain('messageReplyOption');
  });

  it('treats 429 as retryable and parses Retry-After seconds', async () => {
    const fetchImpl = mockFetch(jsonResponse(429, { 'retry-after': '2' }));
    const result = await postToSpace(url, message(), { fetchImpl });
    expect(result.retryable).toBe(true);
    expect(result.status).toBe(429);
    expect(result.retryAfterMs).toBe(2000);
  });

  it('treats 5xx as retryable', async () => {
    const fetchImpl = mockFetch(jsonResponse(503));
    expect((await postToSpace(url, message(), { fetchImpl })).retryable).toBe(true);
  });

  it('treats other 4xx as permanent (not retryable)', async () => {
    const fetchImpl = mockFetch(jsonResponse(400));
    const result = await postToSpace(url, message(), { fetchImpl });
    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(false);
  });

  it('treats a network error as retryable with status 0', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.reject(new Error('connection refused')));
    const result = await postToSpace(url, message(), { fetchImpl });
    expect(result.retryable).toBe(true);
    expect(result.status).toBe(0);
  });
});

describe('redactWebhookUrl', () => {
  it('strips key and token secrets but keeps the space id', () => {
    const redacted = redactWebhookUrl(url);
    expect(redacted).not.toContain('secret-key');
    expect(redacted).not.toContain('secret-token');
    expect(redacted).toContain('AAA');
  });

  it('handles a malformed url without throwing', () => {
    expect(() => redactWebhookUrl('not a url')).not.toThrow();
  });
});
