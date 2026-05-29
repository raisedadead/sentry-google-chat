import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySignature } from './signature.js';

const secret = 'integration-client-secret';
const body = JSON.stringify({ action: 'triggered', data: { event: { title: 'boom' } } });

function sign(payload: string | Buffer, key: string): string {
  return createHmac('sha256', key).update(payload).digest('hex');
}

describe('verifySignature', () => {
  it('accepts a signature computed with the matching secret', () => {
    expect(verifySignature(body, sign(body, secret), secret)).toBe(true);
  });

  it('accepts a Buffer body equal to its string bytes', () => {
    const buf = Buffer.from(body, 'utf8');
    expect(verifySignature(buf, sign(buf, secret), secret)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const sig = sign(body, secret);
    expect(verifySignature(body + ' ', sig, secret)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    expect(verifySignature(body, sign(body, 'other-secret'), secret)).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    expect(verifySignature(body, 'deadbeef', secret)).toBe(false);
  });

  it('rejects an undefined signature header', () => {
    expect(verifySignature(body, undefined, secret)).toBe(false);
  });

  it('rejects an empty signature header', () => {
    expect(verifySignature(body, '', secret)).toBe(false);
  });

  it('is case-sensitive (Sentry sends lowercase hex)', () => {
    const sig = sign(body, secret).toUpperCase();
    expect(verifySignature(body, sig, secret)).toBe(false);
  });
});
