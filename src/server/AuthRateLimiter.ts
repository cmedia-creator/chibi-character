import { HttpError } from './http';
import type { D1Database } from './cloudflare';

export type AuthRateScope = 'register' | 'login' | 'recover';

const encoder = new TextEncoder();

export class AuthRateLimiter {
  constructor(
    private readonly db: D1Database,
    private readonly secret: string,
  ) {
    if (!secret) throw new Error('Rate limit secret is required.');
  }

  async consume(
    request: Request,
    scope: AuthRateScope,
    limit: number,
    windowMs: number,
    now = Date.now(),
  ): Promise<void> {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const bucket = await hmacHex(this.secret, `${scope}|${ip}`);
    const expiresAt = now + windowMs;

    await this.db.prepare(`
      INSERT INTO auth_rate_limits (
        bucket, hits, window_started_at, expires_at, updated_at
      ) VALUES (?, 1, ?, ?, ?)
      ON CONFLICT(bucket) DO UPDATE SET
        hits = CASE
          WHEN auth_rate_limits.expires_at <= excluded.updated_at THEN 1
          ELSE auth_rate_limits.hits + 1
        END,
        window_started_at = CASE
          WHEN auth_rate_limits.expires_at <= excluded.updated_at THEN excluded.window_started_at
          ELSE auth_rate_limits.window_started_at
        END,
        expires_at = CASE
          WHEN auth_rate_limits.expires_at <= excluded.updated_at THEN excluded.expires_at
          ELSE auth_rate_limits.expires_at
        END,
        updated_at = excluded.updated_at
    `).bind(bucket, now, expiresAt, now).run();

    const row = await this.db.prepare(
      'SELECT hits, expires_at FROM auth_rate_limits WHERE bucket = ? LIMIT 1',
    ).bind(bucket).first<{ hits: number; expires_at: number }>();

    if (!row || row.hits > limit) {
      throw new HttpError(429, 'rate_limited', 'Too many attempts. Please try again later.');
    }
  }
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
