import { describe, expect, it } from 'vitest';
import { resolveWebhookUrl } from './space-router.js';

const def = 'https://chat.googleapis.com/v1/spaces/DEFAULT/messages?key=k&token=t';
const apiProd = 'https://chat.googleapis.com/v1/spaces/APIPROD/messages?key=k&token=t';

const gchat = { defaultWebhookUrl: def, routes: { 'api-prod': apiProd } };

describe('resolveWebhookUrl', () => {
  it('routes a known project slug to its space', () => {
    expect(resolveWebhookUrl('api-prod', gchat)).toBe(apiProd);
  });

  it('falls back to the default for an unknown slug', () => {
    expect(resolveWebhookUrl('unmapped', gchat)).toBe(def);
  });

  it('falls back to the default when the slug is undefined', () => {
    expect(resolveWebhookUrl(undefined, gchat)).toBe(def);
  });

  it('falls back to the default when there are no routes', () => {
    expect(resolveWebhookUrl('api-prod', { defaultWebhookUrl: def, routes: {} })).toBe(def);
  });
});
