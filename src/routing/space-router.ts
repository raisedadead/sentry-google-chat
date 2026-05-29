import type { Config } from '../config.js';

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
