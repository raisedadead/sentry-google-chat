import { pino, type Logger } from 'pino';

export type { Logger };

export const REDACT_PATHS = [
  'clientSecret',
  'webhookUrl',
  'dsn',
  '*.clientSecret',
  '*.webhookUrl',
  '*.dsn',
];

export function createLogger(level = 'info'): Logger {
  return pino({
    level,
    redact: { paths: [...REDACT_PATHS], censor: '[redacted]' },
  });
}
