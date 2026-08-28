const RECOVERY_BYTES = 12;
const RECOVERY_SALT_BYTES = 16;
const CLIENT_KDF_ITERATIONS = 120_000;

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

export function generateRecoverySalt(): string {
  return base64urlEncode(randomBytes(RECOVERY_SALT_BYTES));
}

export async function hashPasswordVerifier(
  pepper: string,
  loginId: string,
  verifier: string,
): Promise<string> {
  return hmacBase64url(pepper, `password\n${loginId}\n${verifier}`);
}

export async function hashRecoveryCode(
  pepper: string,
  recoverySalt: string,
  recoveryCode: string,
): Promise<string> {
  return hmacBase64url(
    pepper,
    `recovery\n${recoverySalt}\n${normalizeRecoveryCode(recoveryCode)}`,
  );
}

export async function fakePasswordSalt(pepper: string, loginId: string): Promise<string> {
  const digest = await hmacBytes(pepper, `fake-salt\n${loginId}`);
  return base64urlEncode(digest.slice(0, 16));
}

export function clientKdfIterations(): number {
  return CLIENT_KDF_ITERATIONS;
}

export function isValidVerifier(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function isValidPasswordSalt(value: string): boolean {
  return /^[A-Za-z0-9_-]{22}$/.test(value);
}

export function isValidClientIterations(value: number): boolean {
  return Number.isInteger(value) && value === CLIENT_KDF_ITERATIONS;
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i += 1) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

async function hmacBase64url(secret: string, message: string): Promise<string> {
  return base64urlEncode(await hmacBytes(secret, message));
}

async function hmacBytes(secret: string, message: string): Promise<Uint8Array<ArrayBuffer>> {
  const keyBytes = toArrayBufferBackedUint8Array(new TextEncoder().encode(secret));
  const messageBytes = toArrayBufferBackedUint8Array(new TextEncoder().encode(message));
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, messageBytes);
  return new Uint8Array(signature);
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  crypto.getRandomValues(bytes);
  return bytes;
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function toArrayBufferBackedUint8Array(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  return copy;
}
