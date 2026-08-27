import { base64UrlToBytes, bytesToBase64Url } from './base64url';
import type { AuthenticationCredentialPayload, RegistrationCredentialPayload } from './types';

export interface RegistrationOptionsJson {
  challenge: string;
  rp: PublicKeyCredentialRpEntity;
  user: Omit<PublicKeyCredentialUserEntity, 'id'> & { id: string };
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
  excludeCredentials?: Array<Omit<PublicKeyCredentialDescriptor, 'id'> & { id: string }>;
}

export interface AuthenticationOptionsJson {
  challenge: string;
  timeout?: number;
  rpId?: string;
  userVerification?: UserVerificationRequirement;
  allowCredentials?: Array<Omit<PublicKeyCredentialDescriptor, 'id'> & { id: string }>;
}

export async function createPasskey(options: RegistrationOptionsJson): Promise<RegistrationCredentialPayload> {
  ensureWebAuthn();
  const credential = await navigator.credentials.create({
    publicKey: {
      ...options,
      challenge: base64UrlToBytes(options.challenge),
      user: { ...options.user, id: base64UrlToBytes(options.user.id) },
      excludeCredentials: options.excludeCredentials?.map((item) => ({
        ...item,
        id: base64UrlToBytes(item.id),
      })),
    },
  });

  if (!(credential instanceof PublicKeyCredential)) throw new Error('Passkey registration was cancelled or unsupported.');
  const response = credential.response;
  if (!(response instanceof AuthenticatorAttestationResponse)) throw new Error('Unexpected passkey registration response.');

  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: 'public-key',
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      attestationObject: bytesToBase64Url(response.attestationObject),
      transports: response.getTransports?.() ?? [],
    },
  };
}

export async function getPasskey(options: AuthenticationOptionsJson): Promise<AuthenticationCredentialPayload> {
  ensureWebAuthn();
  const credential = await navigator.credentials.get({
    publicKey: {
      ...options,
      challenge: base64UrlToBytes(options.challenge),
      allowCredentials: options.allowCredentials?.map((item) => ({
        ...item,
        id: base64UrlToBytes(item.id),
      })),
    },
  });

  if (!(credential instanceof PublicKeyCredential)) throw new Error('Passkey authentication was cancelled or unsupported.');
  const response = credential.response;
  if (!(response instanceof AuthenticatorAssertionResponse)) throw new Error('Unexpected passkey authentication response.');

  return {
    id: credential.id,
    rawId: bytesToBase64Url(credential.rawId),
    type: 'public-key',
    response: {
      clientDataJSON: bytesToBase64Url(response.clientDataJSON),
      authenticatorData: bytesToBase64Url(response.authenticatorData),
      signature: bytesToBase64Url(response.signature),
      userHandle: response.userHandle ? bytesToBase64Url(response.userHandle) : null,
    },
  };
}

export function isPasskeyAvailable(): boolean {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window && Boolean(navigator.credentials);
}

function ensureWebAuthn(): void {
  if (!isPasskeyAvailable()) throw new Error('Passkeys are not supported in this browser.');
}
