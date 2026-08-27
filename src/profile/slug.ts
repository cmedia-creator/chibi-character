const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])?$/;

const RESERVED = new Set([
  'api',
  'admin',
  'app',
  'create',
  'creator',
  'login',
  'logout',
  'me',
  'profile',
  'share',
  'shop',
  'settings',
  'support',
  'terms',
  'privacy',
]);

export type SlugValidation =
  | { ok: true; slug: string }
  | { ok: false; reason: 'empty' | 'length' | 'format' | 'reserved' };

export function normalizeSlug(input: string): string {
  return input.trim().toLowerCase();
}

export function validateProfileSlug(input: string): SlugValidation {
  const slug = normalizeSlug(input);
  if (!slug) return { ok: false, reason: 'empty' };
  if (slug.length < 3 || slug.length > 30) return { ok: false, reason: 'length' };
  if (!SLUG_PATTERN.test(slug)) return { ok: false, reason: 'format' };
  if (RESERVED.has(slug)) return { ok: false, reason: 'reserved' };
  return { ok: true, slug };
}

export function profilePath(slug: string): string {
  const result = validateProfileSlug(slug);
  if (!result.ok) throw new Error(`Invalid profile slug: ${result.reason}`);
  return `/p/${result.slug}`;
}
