import { describe, expect, it } from 'vitest';
import type { AlertEvent } from '../domain/alert-event.js';
import { renderAlertCard } from './card.js';

function makeEvent(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    kind: 'issue_alert',
    severity: 'critical',
    title: 'ReferenceError: heck is not defined',
    level: 'error',
    projectSlug: 'api-prod',
    url: 'https://my-org.sentry.io/issues/1117540176/',
    ruleLabel: 'Very Important Alert Rule!',
    description: undefined,
    culprit: '?(<anonymous>)',
    environment: 'production',
    timestamp: '2019-08-19T21:06:17.677000Z',
    groupingKey: '1117540176',
    ...overrides,
  };
}

describe('renderAlertCard', () => {
  it('builds a cardsV2 message for an issue alert', () => {
    const msg = renderAlertCard(makeEvent());
    expect(msg.cardsV2).toHaveLength(1);
    const card = msg.cardsV2[0]!.card;
    expect(card.header?.title).toContain('Critical');
    expect(card.sections.length).toBeGreaterThan(0);
    expect(msg.fallbackText).toContain('ReferenceError');
    expect(msg.thread?.threadKey).toBe('issue_alert:1117540176');
  });

  it('uses onClick.openLink for the View button (webhook constraint)', () => {
    const msg = renderAlertCard(makeEvent());
    const json = JSON.stringify(msg);
    expect(json).toContain('"openLink"');
    expect(json).not.toContain('"action"');
    expect(json).toContain('https://my-org.sentry.io/issues/1117540176/');
  });

  it('omits the button when there is no url', () => {
    const msg = renderAlertCard(makeEvent({ url: undefined }));
    expect(JSON.stringify(msg)).not.toContain('buttonList');
  });

  it('renders a metric alert description and groups by metric thread key', () => {
    const msg = renderAlertCard(
      makeEvent({
        kind: 'metric_alert',
        title: 'Error rate is high',
        description: '1000 events in the last 10 minutes',
        culprit: undefined,
        groupingKey: '123',
      })
    );
    expect(JSON.stringify(msg)).toContain('1000 events in the last 10 minutes');
    expect(msg.thread?.threadKey).toBe('metric_alert:123');
  });

  it.each([
    ['critical', '🔴'],
    ['warning', '🟠'],
    ['info', '🔵'],
    ['resolved', '✅'],
  ] as const)('prefixes %s severity with %s', (severity, emoji) => {
    const msg = renderAlertCard(makeEvent({ severity }));
    expect(msg.cardsV2[0]!.card.header?.title).toContain(emoji);
    expect(msg.fallbackText).toContain(emoji);
  });

  it('HTML-escapes untrusted text in rendered card widgets to prevent markup injection', () => {
    const msg = renderAlertCard(makeEvent({ title: '<script>alert(1)</script> & <b>x</b>' }));
    const cardJson = JSON.stringify(msg.cardsV2);
    expect(cardJson).not.toContain('<script>');
    expect(cardJson).toContain('&lt;script&gt;');
    expect(cardJson).toContain('&amp;');
  });

  it('stays well under the 32KB Google Chat card limit even with huge input', () => {
    const huge = 'x'.repeat(50_000);
    const msg = renderAlertCard(makeEvent({ title: huge, description: huge, culprit: huge }));
    expect(JSON.stringify(msg).length).toBeLessThan(32_000);
  });
});
