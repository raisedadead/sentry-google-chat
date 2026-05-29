import * as Sentry from '@sentry/node';

// Must be imported before any other application module so Sentry can
// instrument them. With no SENTRY_DSN set, init is a no-op (nothing is sent).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0,
});
