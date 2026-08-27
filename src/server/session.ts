import type { ServerRepository } from './Repository';

const COOKIE_NAME = 'chibi_session';

export async function resolveSessionUserId(
  repository: ServerRepository,
  request: Request,
  now: number,
): Promise<string | null> {
  const token = readCookie(request.headers.get('cookie'), COOKIE_NAME);
  if (!token || token.length > 256) return null;
  const hash = await sha256Hex(token);
  return repository.sessionUserId(hash, now);
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index < 0) continue;
    const key = pair.slice(0, index).trim();
    if (key !== name) continue;
    const raw = pair.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}
