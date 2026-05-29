import { z } from 'zod';

const stringOrNumber = z.union([z.string(), z.number()]);

const actorSchema = z
  .object({
    id: stringOrNumber.optional(),
    name: z.string().optional(),
    type: z.string().optional(),
  })
  .optional();

const installationSchema = z.object({ uuid: z.string() }).optional();

const sentryEventSchema = z.object({
  event_id: z.string().optional(),
  project: stringOrNumber.optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  platform: z.string().optional(),
  culprit: z.string().nullish(),
  level: z.string().optional(),
  environment: z.string().optional(),
  url: z.string().optional(),
  web_url: z.string().optional(),
  issue_url: z.string().optional(),
  issue_id: stringOrNumber.optional(),
  datetime: z.string().optional(),
  timestamp: stringOrNumber.optional(),
  tags: z
    .array(z.tuple([z.string(), z.string().nullable()]))
    .optional()
    .catch(undefined),
});

export const eventAlertSchema = z.object({
  action: z.string(),
  actor: actorSchema,
  installation: installationSchema,
  data: z.object({
    event: sentryEventSchema,
    triggered_rule: z.string().optional(),
    issue_alert: z
      .object({
        title: z.string().optional(),
        settings: z.array(z.object({ name: z.string(), value: z.unknown() })).optional(),
      })
      .optional(),
  }),
});

const metricAlertRuleSchema = z.object({
  id: stringOrNumber.optional(),
  name: z.string().optional(),
  aggregate: z.string().optional(),
  dataset: z.string().optional(),
  query: z.string().optional(),
  time_window: z.number().optional(),
  threshold_type: z.number().optional(),
  resolve_threshold: z.number().nullish(),
  threshold_period: z.number().optional(),
  projects: z.array(z.string()).optional(),
  status: z.number().optional(),
});

const metricAlertIncidentSchema = z.object({
  id: stringOrNumber.optional(),
  identifier: stringOrNumber.optional(),
  organization_id: stringOrNumber.optional(),
  title: z.string().optional(),
  status: z.number().optional(),
  status_method: z.number().optional(),
  type: z.number().optional(),
  date_created: z.string().optional(),
  date_started: z.string().nullish(),
  date_detected: z.string().nullish(),
  date_closed: z.string().nullish(),
  projects: z.array(z.string()).optional(),
  alert_rule: metricAlertRuleSchema.optional(),
});

export const metricAlertSchema = z.object({
  action: z.string(),
  actor: actorSchema,
  installation: installationSchema,
  data: z.object({
    description_text: z.string().optional(),
    description_title: z.string().optional(),
    web_url: z.string().optional(),
    metric_alert: metricAlertIncidentSchema,
  }),
});

export type EventAlertPayload = z.infer<typeof eventAlertSchema>;
export type MetricAlertPayload = z.infer<typeof metricAlertSchema>;
export type SentryEvent = z.infer<typeof sentryEventSchema>;
