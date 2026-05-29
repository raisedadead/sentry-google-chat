import type { Config } from '../config.js';

/**
 * Resolves the Google Chat space webhook URL for an alert's project. A project
 * slug with an explicit route goes to its space; everything else falls back to
 * the always-configured default space, so an alert is never silently dropped.
 */
export function resolveWebhookUrl(
  projectSlug: string | undefined,
  gchat: Pick<Config['gchat'], 'defaultWebhookUrl' | 'routes'>
): string {
  if (projectSlug !== undefined) {
    const routed = gchat.routes[projectSlug];
    if (routed !== undefined) return routed;
  }
  return gchat.defaultWebhookUrl;
}
