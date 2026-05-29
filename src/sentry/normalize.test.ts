import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventAlertSchema, metricAlertSchema } from './schemas.js';
import { normalizeEventAlert, normalizeMetricAlert } from './normalize.js';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../test/fixtures/${name}`, import.meta.url), 'utf8'));
}

describe('normalizeEventAlert', () => {
  it('normalizes a real issue-alert payload', () => {
    const event = normalizeEventAlert(eventAlertSchema.parse(fixture('event-alert.json')));
    expect(event.kind).toBe('issue_alert');
    expect(event.severity).toBe('critical');
    expect(event.title).toBe('ReferenceError: heck is not defined');
    expect(event.level).toBe('error');
    expect(event.projectSlug).toBe('api-prod');
    expect(event.url).toContain('my-org.sentry.io/issues/1117540176');
    expect(event.ruleLabel).toBe('Very Important Alert Rule!');
    expect(event.environment).toBe('production');
    expect(event.culprit).toBe('?(<anonymous>)');
    expect(event.groupingKey).toBe('1117540176');
  });

  it.each([
    ['fatal', 'critical'],
    ['error', 'critical'],
    ['warning', 'warning'],
    ['info', 'info'],
    ['debug', 'info'],
    ['nonsense', 'info'],
  ])('maps level %s to severity %s', (level, severity) => {
    const event = normalizeEventAlert(
      eventAlertSchema.parse({ action: 'triggered', data: { event: { title: 't', level } } })
    );
    expect(event.severity).toBe(severity);
  });

  it('falls back to the numeric project id when the url has no slug', () => {
    const event = normalizeEventAlert(
      eventAlertSchema.parse({ action: 'triggered', data: { event: { title: 't', project: 7 } } })
    );
    expect(event.projectSlug).toBe('7');
  });

  it('derives an ISO timestamp from an epoch event timestamp', () => {
    const event = normalizeEventAlert(
      eventAlertSchema.parse({
        action: 'triggered',
        data: { event: { title: 't', timestamp: 1566248777.677 } },
      })
    );
    expect(event.timestamp).toBe(new Date(1566248777.677 * 1000).toISOString());
  });

  it('uses a safe title fallback when none is present', () => {
    const event = normalizeEventAlert(
      eventAlertSchema.parse({ action: 'triggered', data: { event: {} } })
    );
    expect(event.title.length).toBeGreaterThan(0);
  });
});

describe('normalizeMetricAlert', () => {
  it('normalizes a real metric-alert payload', () => {
    const event = normalizeMetricAlert(metricAlertSchema.parse(fixture('metric-alert.json')));
    expect(event.kind).toBe('metric_alert');
    expect(event.severity).toBe('critical');
    expect(event.title).toBe('Error rate is high');
    expect(event.projectSlug).toBe('api-prod');
    expect(event.url).toContain('alerts/rules/details/1');
    expect(event.ruleLabel).toBe('Error rate is high');
    expect(event.description).toContain('1000 events');
    expect(event.groupingKey).toBe('123');
  });

  it.each([
    ['critical', 'critical'],
    ['warning', 'warning'],
    ['resolved', 'resolved'],
    ['weird', 'info'],
  ])('maps action %s to severity %s', (action, severity) => {
    const event = normalizeMetricAlert(
      metricAlertSchema.parse({ action, data: { metric_alert: { title: 't', projects: ['p'] } } })
    );
    expect(event.severity).toBe(severity);
  });
});
