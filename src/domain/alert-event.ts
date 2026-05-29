export type AlertKind = 'issue_alert' | 'metric_alert';

export type Severity = 'critical' | 'warning' | 'info' | 'resolved';

/**
 * Normalized, transport-agnostic representation of a Sentry alert. Both
 * issue alerts (event_alert) and metric alerts collapse into this shape so the
 * card renderer and router never touch raw Sentry payloads.
 */
export interface AlertEvent {
  readonly kind: AlertKind;
  readonly severity: Severity;
  readonly title: string;
  readonly level: string | undefined;
  readonly projectSlug: string | undefined;
  readonly url: string | undefined;
  readonly ruleLabel: string | undefined;
  readonly description: string | undefined;
  readonly culprit: string | undefined;
  readonly environment: string | undefined;
  readonly timestamp: string | undefined;
  readonly groupingKey: string;
}
