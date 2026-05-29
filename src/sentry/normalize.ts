import type { AlertEvent, Severity } from '../domain/alert-event.js';
import type { EventAlertPayload, MetricAlertPayload, SentryEvent } from './schemas.js';

function levelToSeverity(level: string | undefined): Severity {
  switch (level) {
    case 'fatal':
    case 'error':
      return 'critical';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

function actionToSeverity(action: string): Severity {
  switch (action) {
    case 'critical':
      return 'critical';
    case 'warning':
      return 'warning';
    case 'resolved':
      return 'resolved';
    default:
      return 'info';
  }
}

function parseProjectSlug(apiUrl: string | undefined): string | undefined {
  if (!apiUrl) return undefined;
  const match = /\/projects\/[^/]+\/([^/]+)/.exec(apiUrl);
  return match?.[1];
}

function findTag(tags: SentryEvent['tags'], key: string): string | undefined {
  if (!tags) return undefined;
  for (const tag of tags) {
    if (tag[0] === key && tag[1] != null) return tag[1];
  }
  return undefined;
}

function toIsoTimestamp(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  return new Date(value * 1000).toISOString();
}

export function normalizeEventAlert(payload: EventAlertPayload): AlertEvent {
  const { event, triggered_rule, issue_alert } = payload.data;
  const title = event.title ?? event.message ?? event.culprit ?? 'Sentry issue alert';

  return {
    kind: 'issue_alert',
    severity: levelToSeverity(event.level),
    title,
    level: event.level,
    projectSlug:
      parseProjectSlug(event.url) ??
      (event.project !== undefined ? String(event.project) : undefined),
    url: event.web_url ?? event.issue_url ?? event.url,
    ruleLabel: triggered_rule ?? issue_alert?.title,
    description: undefined,
    culprit: event.culprit ?? undefined,
    environment: event.environment ?? findTag(event.tags, 'environment'),
    timestamp: event.datetime ?? toIsoTimestamp(event.timestamp),
    groupingKey: String(event.issue_id ?? event.event_id ?? title),
  };
}

export function normalizeMetricAlert(payload: MetricAlertPayload): AlertEvent {
  const { description_text, description_title, web_url, metric_alert } = payload.data;
  const rule = metric_alert.alert_rule;
  const title = metric_alert.title ?? description_title ?? rule?.name ?? 'Sentry metric alert';

  return {
    kind: 'metric_alert',
    severity: actionToSeverity(payload.action),
    title,
    level: payload.action,
    projectSlug: metric_alert.projects?.[0] ?? rule?.projects?.[0],
    url: web_url,
    ruleLabel: rule?.name ?? metric_alert.title,
    description: description_text,
    culprit: undefined,
    environment: undefined,
    timestamp: metric_alert.date_started ?? metric_alert.date_detected ?? metric_alert.date_created,
    groupingKey: String(metric_alert.id ?? metric_alert.identifier ?? rule?.id ?? title),
  };
}
