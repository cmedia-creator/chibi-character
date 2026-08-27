import { HttpError } from './http';
import { clientIpFromRequest, TurnstileVerifier } from './TurnstileVerifier';

export type ProtectedAction =
  | 'passkey-register'
  | 'profile-publish'
  | 'share-asset-create';

export class AbuseGuard {
  constructor(private readonly turnstile: TurnstileVerifier) {}

  async requireTurnstile(
    request: Request,
    token: string,
    action: ProtectedAction,
  ): Promise<void> {
    const url = new URL(request.url);
    const result = await this.turnstile.verify({
      token,
      remoteIp: clientIpFromRequest(request),
      expectedHostname: url.hostname,
      expectedAction: action,
      idempotencyKey: crypto.randomUUID(),
    });

    if (!result.success) {
      throw new HttpError(403, 'forbidden', 'Human verification failed.');
    }
  }
}
