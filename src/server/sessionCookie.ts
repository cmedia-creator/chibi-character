const COOKIE_NAME = 'chibi_session';

export function createSessionCookie(token: string, expiresAt: number): string {
  const expires = new Date(expiresAt).toUTCString();
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Expires=${expires}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
}

export function clearSessionCookie(): string {
  return [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
}
