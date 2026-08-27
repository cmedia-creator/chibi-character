export type WebAuthnPurpose = 'register' | 'authenticate';

export interface StoredPasskeyCredential {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: Uint8Array<ArrayBuffer>;
  signCount: number;
  transports: string[];
  createdAt: number;
}

export interface StoredChallenge {
  challengeHash: string;
  userId: string | null;
  purpose: WebAuthnPurpose;
  expiresAt: number;
  createdAt: number;
}

export interface CreatedSession {
  token: string;
  expiresAt: number;
}

export interface RegistrationCredentialPayload {
  id: string;
  rawId: string;
  type: 'public-key';
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports: string[];
  };
}

export interface AuthenticationCredentialPayload {
  id: string;
  rawId: string;
  type: 'public-key';
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle: string | null;
  };
}
