import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { createApp } from './app.js';
import type { DeliveryJob } from './delivery/queue.js';

const SECRET = 'test-client-secret';
const DEFAULT_URL = 'https://chat.googleapis.com/v1/spaces/DEFAULT/messages?key=k&token=t';
const API_PROD_URL = 'https://chat.googleapis.com/v1/spaces/APIPROD/messages?key=k&token=t';

function fixtureText(name: string): string {
  return readFileSync(new URL(`../test/fixtures/${name}`, import.meta.url), 'utf8');
}

function sign(body: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

let enqueue: Mock<(job: DeliveryJob) => boolean>;

function app() {
  enqueue = vi.fn<(job: DeliveryJob) => boolean>(() => true);
  return createApp({
    clientSecret: SECRET,
    gchat: { defaultWebhookUrl: DEFAULT_URL, routes: { 'api-prod': API_PROD_URL } },
    queue: { enqueue },
  });
}

function webhookRequest(body: string, resource: string, headers: Record<string, string> = {}) {
  return new Request('http://local/sentry/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'sentry-hook-resource': resource,
      'sentry-hook-signature': sign(body),
      'request-id': 'req-1',
      ...headers,
    },
    body,
  });
}

describe('GET /healthz', () => {
  it('returns ok', async () => {
    const res = await app().request('http://local/healthz');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

describe('POST /sentry/webhook', () => {
  it('accepts a valid issue alert and enqueues a routed delivery', async () => {
    const a = app();
    const body = fixtureText('event-alert.json');
    const res = await a.request(webhookRequest(body, 'event_alert'));
    expect(res.status).toBe(202);
    expect(enqueue).toHaveBeenCalledTimes(1);
    const job = enqueue.mock.calls[0]![0];
    expect(job.webhookUrl).toBe(API_PROD_URL);
    expect(job.requestId).toBe('req-1');
    expect(JSON.stringify(job.message)).toContain('cardsV2');
  });

  it('accepts a valid metric alert', async () => {
    const a = app();
    const res = await a.request(webhookRequest(fixtureText('metric-alert.json'), 'metric_alert'));
    expect(res.status).toBe(202);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid signature with 401 and does not enqueue', async () => {
    const a = app();
    const body = fixtureText('event-alert.json');
    const req = new Request('http://local/sentry/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'sentry-hook-resource': 'event_alert',
        'sentry-hook-signature': sign(body, 'wrong-secret'),
        'request-id': 'req-1',
      },
      body,
    });
    const res = await a.request(req);
    expect(res.status).toBe(401);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('rejects a missing signature with 401', async () => {
    const a = app();
    const body = fixtureText('event-alert.json');
    const req = new Request('http://local/sentry/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sentry-hook-resource': 'event_alert' },
      body,
    });
    expect((await a.request(req)).status).toBe(401);
  });

  it('acknowledges an unsubscribed resource with 200 without enqueuing', async () => {
    const a = app();
    const body = JSON.stringify({ action: 'created', data: {} });
    const res = await a.request(webhookRequest(body, 'comment'));
    expect(res.status).toBe(200);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('acknowledges the installation webhook with 200', async () => {
    const a = app();
    const body = JSON.stringify({ action: 'created', installation: { uuid: 'x' } });
    const res = await a.request(webhookRequest(body, 'installation'));
    expect(res.status).toBe(200);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('returns 400 for a malformed JSON body', async () => {
    const a = app();
    const body = '{not json';
    const res = await a.request(webhookRequest(body, 'event_alert'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for a schema-invalid event alert', async () => {
    const a = app();
    const body = JSON.stringify({ action: 'triggered' });
    const res = await a.request(webhookRequest(body, 'event_alert'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when the resource header is missing', async () => {
    const a = app();
    const body = fixtureText('event-alert.json');
    const req = new Request('http://local/sentry/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'sentry-hook-signature': sign(body) },
      body,
    });
    expect((await a.request(req)).status).toBe(400);
  });

  it('falls back to a synthetic request id when the header is absent', async () => {
    const a = app();
    const body = fixtureText('metric-alert.json');
    const req = new Request('http://local/sentry/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'sentry-hook-resource': 'metric_alert',
        'sentry-hook-signature': sign(body),
      },
      body,
    });
    const res = await a.request(req);
    expect(res.status).toBe(202);
    const job = enqueue.mock.calls[0]![0];
    expect(job.requestId.length).toBeGreaterThan(0);
  });
});
