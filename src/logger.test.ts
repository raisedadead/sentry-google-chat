import { describe, expect, it } from 'vitest';
import { createLogger, REDACT_PATHS } from './logger.js';

describe('createLogger', () => {
  it('defaults to the info level', () => {
    expect(createLogger().level).toBe('info');
  });

  it('honors a requested level', () => {
    const log = createLogger('warn');
    expect(log.level).toBe('warn');
    expect(typeof log.info).toBe('function');
    expect(typeof log.error).toBe('function');
  });

  it('lists secret-bearing fields for redaction', () => {
    expect(REDACT_PATHS).toContain('webhookUrl');
    expect(REDACT_PATHS).toContain('clientSecret');
  });
});
