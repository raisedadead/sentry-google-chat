import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies the `Sentry-Hook-Signature` header against the raw request body.
 *
 * Sentry signs the EXACT request body bytes with HMAC-SHA256 keyed by the
 * integration Client Secret, hex-encoded; the timestamp is NOT part of the
 * signed input (verified against getsentry/sentry
 * src/sentry/sentry_apps/services/app/model.py `build_signature`). The body
 * must be the raw bytes Sentry sent — re-serializing parsed JSON reorders keys
 * and breaks the digest (getsentry/sentry#31012).
 */
export function verifySignature(
  rawBody: Buffer | string,
  signature: string | undefined | null,
  secret: string
): boolean {
  if (!signature) return false;

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBytes = Buffer.from(expected, 'utf8');
  const providedBytes = Buffer.from(signature, 'utf8');

  if (expectedBytes.length !== providedBytes.length) return false;
  return timingSafeEqual(expectedBytes, providedBytes);
}
