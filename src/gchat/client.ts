import type { GoogleChatMessage } from './card.js';

export interface DeliveryResult {
  ok: boolean;
  status: number;
  retryable: boolean;
  retryAfterMs?: number;
}

export interface PostOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

const REPLY_OPTION = 'REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD';
const DEFAULT_TIMEOUT_MS = 10_000;

export function redactWebhookUrl(webhookUrl: string): string {
  try {
    const url = new URL(webhookUrl);
    const spaceMatch = /\/spaces\/([^/]+)/.exec(url.pathname);
    const space = spaceMatch?.[1] ?? 'unknown';
    return `${url.host}/spaces/${space}`;
  } catch {
    return '<invalid-webhook-url>';
  }
}

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

export async function postToSpace(
  webhookUrl: string,
  message: GoogleChatMessage,
  options: PostOptions = {}
): Promise<DeliveryResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const target = new URL(webhookUrl);
  if (message.thread) {
    target.searchParams.set('messageReplyOption', REPLY_OPTION);
  }

  try {
    const response = await fetchImpl(target.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) {
      return { ok: true, status: response.status, retryable: false };
    }

    const retryable = response.status === 429 || response.status >= 500;
    const retryAfterMs =
      response.status === 429 ? parseRetryAfterMs(response.headers.get('retry-after')) : undefined;

    return {
      ok: false,
      status: response.status,
      retryable,
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    };
  } catch {
    return { ok: false, status: 0, retryable: true };
  }
}
