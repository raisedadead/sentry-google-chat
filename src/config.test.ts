import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const validUrl = 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=k&token=t';
const altUrl = 'https://chat.googleapis.com/v1/spaces/BBB/messages?key=k2&token=t2';

function baseEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    SENTRY_CLIENT_SECRET: 'client-secret-123',
    GCHAT_WEBHOOK_DEFAULT: validUrl,
    ...overrides,
  };
}

describe('loadConfig', () => {
  it('loads a minimal valid env with defaults', () => {
    const cfg = loadConfig(baseEnv());
    expect(cfg.sentry.clientSecret).toBe('client-secret-123');
    expect(cfg.sentry.dsn).toBeUndefined();
    expect(cfg.gchat.defaultWebhookUrl).toBe(validUrl);
    expect(cfg.gchat.routes).toEqual({});
    expect(cfg.server.port).toBe(8080);
    expect(cfg.server.logLevel).toBe('info');
    expect(cfg.server.nodeEnv).toBe('development');
  });

  it('throws when SENTRY_CLIENT_SECRET is missing', () => {
    expect(() => loadConfig(baseEnv({ SENTRY_CLIENT_SECRET: undefined }))).toThrow(
      /SENTRY_CLIENT_SECRET/
    );
  });

  it('throws when GCHAT_WEBHOOK_DEFAULT is missing', () => {
    expect(() => loadConfig(baseEnv({ GCHAT_WEBHOOK_DEFAULT: undefined }))).toThrow(
      /GCHAT_WEBHOOK_DEFAULT/
    );
  });

  it('rejects a default webhook URL on the wrong host', () => {
    expect(() =>
      loadConfig(baseEnv({ GCHAT_WEBHOOK_DEFAULT: 'https://evil.example.com/hook' }))
    ).toThrow(/GCHAT_WEBHOOK_DEFAULT/);
  });

  it('rejects a non-https default webhook URL', () => {
    expect(() =>
      loadConfig(baseEnv({ GCHAT_WEBHOOK_DEFAULT: 'http://chat.googleapis.com/v1/spaces/x' }))
    ).toThrow(/GCHAT_WEBHOOK_DEFAULT/);
  });

  it('parses GCHAT_ROUTES into a slug -> url map', () => {
    const cfg = loadConfig(baseEnv({ GCHAT_ROUTES: JSON.stringify({ 'api-prod': altUrl }) }));
    expect(cfg.gchat.routes).toEqual({ 'api-prod': altUrl });
  });

  it('throws a clear error on malformed GCHAT_ROUTES JSON without echoing its content', () => {
    const malformed = `{"api":"${validUrl}`; /* missing closing */
    let thrown: unknown;
    try {
      loadConfig(baseEnv({ GCHAT_ROUTES: malformed }));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/GCHAT_ROUTES/);
    expect((thrown as Error).message).not.toContain('token=t');
  });

  it('rejects a route whose URL is not a Google Chat webhook', () => {
    expect(() =>
      loadConfig(baseEnv({ GCHAT_ROUTES: JSON.stringify({ web: 'https://evil.example.com' }) }))
    ).toThrow(/GCHAT_ROUTES|web/);
  });

  it('coerces PORT from string', () => {
    expect(loadConfig(baseEnv({ PORT: '3000' })).server.port).toBe(3000);
  });

  it('rejects an invalid LOG_LEVEL', () => {
    expect(() => loadConfig(baseEnv({ LOG_LEVEL: 'loud' }))).toThrow(/LOG_LEVEL/);
  });

  it('never includes a secret value in a validation error message', () => {
    const secret = 'SUPER_SECRET_DO_NOT_LEAK';
    let thrown: unknown;
    try {
      loadConfig(baseEnv({ SENTRY_CLIENT_SECRET: secret, PORT: 'not-a-number' }));
    } catch (err) {
      thrown = err;
    }
    expect((thrown as Error).message).not.toContain(secret);
  });
});
