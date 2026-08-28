const PBKDF2_ITERATIONS = 120_000;
const HASH_BYTES = 32;
const SALT_BYTES = 16;
const RECOVERY_BYTES = 12;

export interface PasswordHash {
  salt: string;
  hash: string;
  iterations: number;
}

export async function hashPassword(value: string): Promise<PasswordHash> {
  const saltBytes = randomBytes(SALT_BYTES);
  const hashBytes = await derive(value, saltBytes, PBKDF2_ITERATIONS);
  return {
    salt: base64urlEncode(saltBytes),
    hash: base64urlEncode(hashBytes),
    iterations: PBKDF2_ITERATIONS,
  };
}

export async function verifyPassword(
  value: string,
  salt: string,
  expectedHash: string,
  iterations: number,
): Promise<boolean> {
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 1_000_000) return false;
  try {
    const actual = await derive(value, base64urlDecode(salt), iterations);
    const expected = base64urlDecode(expectedHash);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function generateRecoveryCode(): string {
  const hex = [...randomBytes(RECOVERY_BYTES)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return hex.match(/.{1,4}/g)?.join('-') ?? hex;
}

export function normalizeRecoveryCode(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

async function derive(
  value: string,
  saltInput: Uint8Array,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const salt = toArrayBufferBackedUint8Array(saltInput);
  const materialBytes = toArrayBufferBackedUint8Array(new TextEncoder().encode(value));
  const material = await crypto.subtle.importKey(
    'raw',
    materialBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations,
    },
    material,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(bytes);
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toArrayBufferBackedUint8Array(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  return copy;
}
