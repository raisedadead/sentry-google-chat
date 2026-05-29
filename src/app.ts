import { Hono } from 'hono';
import type { Config } from './config.js';
import type { AlertEvent } from './domain/alert-event.js';
import type { DeliveryJob } from './delivery/queue.js';
import { renderAlertCard } from './gchat/card.js';
import { resolveWebhookUrl } from './routing/space-router.js';
import { eventAlertSchema, metricAlertSchema } from './sentry/schemas.js';
import { normalizeEventAlert, normalizeMetricAlert } from './sentry/normalize.js';
import { verifySignature } from './sentry/signature.js';

export interface AppLogger {
  debug(obj: object, msg?: string): void;
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

export interface AppDeps {
  clientSecret: string;
  gchat: Pick<Config['gchat'], 'defaultWebhookUrl' | 'routes'>;
  queue: { enqueue(job: DeliveryJob): boolean };
  logger?: AppLogger;
}

const noopLogger: AppLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export function createApp(deps: AppDeps): Hono {
  const logger = deps.logger ?? noopLogger;
  const app = new Hono();

  app.get('/healthz', (c) => c.json({ status: 'ok' }));

  app.post('/sentry/webhook', async (c) => {
    const rawBody = Buffer.from(await c.req.arrayBuffer());
    const signature = c.req.header('sentry-hook-signature');
    if (!verifySignature(rawBody, signature, deps.clientSecret)) {
      logger.warn({}, 'rejected webhook with invalid signature');
      return c.text('invalid signature', 401);
    }

    const resource = c.req.header('sentry-hook-resource');
    if (!resource) {
      return c.text('missing Sentry-Hook-Resource header', 400);
    }

    if (resource !== 'event_alert' && resource !== 'metric_alert') {
      logger.debug({ resource }, 'acknowledged unsubscribed resource');
      return c.json({ status: 'ignored' }, 200);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return c.text('invalid JSON body', 400);
    }

    let event: AlertEvent;
    if (resource === 'event_alert') {
      const parsed = eventAlertSchema.safeParse(payload);
      if (!parsed.success) return c.text('invalid event_alert payload', 400);
      event = normalizeEventAlert(parsed.data);
    } else {
      const parsed = metricAlertSchema.safeParse(payload);
      if (!parsed.success) return c.text('invalid metric_alert payload', 400);
      event = normalizeMetricAlert(parsed.data);
    }

    const message = renderAlertCard(event);
    const webhookUrl = resolveWebhookUrl(event.projectSlug, deps.gchat);
    const requestId = c.req.header('request-id') ?? `${resource}:${event.groupingKey}`;

    const accepted = deps.queue.enqueue({ webhookUrl, message, requestId });
    logger.info(
      { resource, project: event.projectSlug, severity: event.severity, accepted },
      'queued alert for delivery'
    );
    return c.json({ status: 'queued' }, 202);
  });

  app.onError((err, c) => {
    logger.error({ err }, 'unhandled error in webhook handler');
    return c.text('internal server error', 500);
  });

  return app;
}
