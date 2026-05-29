import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eventAlertSchema, metricAlertSchema } from './schemas.js';

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../test/fixtures/${name}`, import.meta.url), 'utf8'));
}

describe('eventAlertSchema', () => {
  it('parses a real issue-alert (event_alert) payload', () => {
    const parsed = eventAlertSchema.parse(fixture('event-alert.json'));
    expect(parsed.action).toBe('triggered');
    expect(parsed.data.event.title).toBe('ReferenceError: heck is not defined');
    expect(parsed.data.event.url).toContain('/projects/my-org/api-prod/');
    expect(parsed.data.triggered_rule).toBe('Very Important Alert Rule!');
    expect(parsed.data.event.tags).toHaveLength(4);
  });

  it('ignores unknown extra fields (forward compatible)', () => {
    const base = fixture('event-alert.json') as Record<string, unknown>;
    const withExtra = { ...base, brandNewSentryField: { nested: true } };
    expect(() => eventAlertSchema.parse(withExtra)).not.toThrow();
  });

  it('parses a minimal event with only a title', () => {
    const parsed = eventAlertSchema.parse({
      action: 'triggered',
      data: { event: { title: 'boom' } },
    });
    expect(parsed.data.event.title).toBe('boom');
  });

  it('rejects a payload missing data', () => {
    expect(eventAlertSchema.safeParse({ action: 'triggered' }).success).toBe(false);
  });
});

describe('metricAlertSchema', () => {
  it('parses a real metric-alert payload', () => {
    const parsed = metricAlertSchema.parse(fixture('metric-alert.json'));
    expect(parsed.action).toBe('critical');
    expect(parsed.data.metric_alert.projects).toEqual(['api-prod']);
    expect(parsed.data.description_title).toBe('Critical: Error rate is high');
    expect(parsed.data.metric_alert.title).toBe('Error rate is high');
  });

  it('ignores unknown extra fields (forward compatible)', () => {
    const base = fixture('metric-alert.json') as Record<string, unknown>;
    const withExtra = { ...base, seerScore: 0.9 };
    expect(() => metricAlertSchema.parse(withExtra)).not.toThrow();
  });

  it('rejects a payload missing metric_alert', () => {
    expect(
      metricAlertSchema.safeParse({ action: 'critical', data: { description_text: 'x' } }).success
    ).toBe(false);
  });
});
