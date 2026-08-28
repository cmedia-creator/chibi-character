const PASSWORD_ITERATIONS = 120_000;
const HASH_BYTES = 32;
const SALT_BYTES = 16;

export interface PasswordMaterial {
  verifier: string;
  salt: string;
  iterations: number;
}

export async function createPasswordMaterial(password: string): Promise<PasswordMaterial> {
  validatePassword(password);
  const salt = randomBytes(SALT_BYTES);
  const verifier = await derive(password, salt, PASSWORD_ITERATIONS);
  return {
    verifier: base64urlEncode(verifier),
    salt: base64urlEncode(salt),
    iterations: PASSWORD_ITERATIONS,
  };
}

export async function derivePasswordVerifier(
  password: string,
  salt: string,
  iterations: number,
): Promise<string> {
  validatePassword(password);
  if (iterations !== PASSWORD_ITERATIONS) throw new Error('Unsupported password KDF settings.');
  const decodedSalt = base64urlDecode(salt);
  if (decodedSalt.byteLength !== SALT_BYTES) throw new Error('Invalid password salt.');
  return base64urlEncode(await derive(password, decodedSalt, iterations));
}

async function derive(
  password: string,
  saltInput: Uint8Array,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const passwordBytes = toArrayBufferBackedUint8Array(new TextEncoder().encode(password));
  const salt = toArrayBufferBackedUint8Array(saltInput);
  const key = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
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
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

function validatePassword(password: string): void {
  if (password.length < 8 || password.length > 128) {
    throw new Error('パスワードは8〜128文字で入力してください。');
  }
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
