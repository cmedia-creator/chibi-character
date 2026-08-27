const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileVerificationResult {
  success: boolean;
  challengeTimestamp: string | null;
  hostname: string | null;
  action: string | null;
  cdata: string | null;
  errorCodes: string[];
}

export interface TurnstileVerifyInput {
  token: string;
  remoteIp?: string | null;
  expectedHostname?: string;
  expectedAction?: string;
  idempotencyKey?: string;
}

type SiteverifyResponse = {
  success?: boolean;
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
  'error-codes'?: string[];
};

export class TurnstileVerifier {
  constructor(
    private readonly secret: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    if (!secret) throw new Error('Turnstile secret is required.');
  }

  async verify(input: TurnstileVerifyInput): Promise<TurnstileVerificationResult> {
    if (!input.token || input.token.length > 4096) {
      return {
        success: false,
        challengeTimestamp: null,
        hostname: null,
        action: null,
        cdata: null,
        errorCodes: ['invalid-input-response'],
      };
    }

    const body = new FormData();
    body.set('secret', this.secret);
    body.set('response', input.token);
    if (input.remoteIp) body.set('remoteip', input.remoteIp);
    if (input.idempotencyKey) body.set('idempotency_key', input.idempotencyKey);

    const response = await this.fetcher(SITEVERIFY_URL, {
      method: 'POST',
      body,
    });
    if (!response.ok) throw new Error(`Turnstile Siteverify HTTP ${response.status}`);

    const payload = await response.json() as SiteverifyResponse;
    const hostname = payload.hostname ?? null;
    const action = payload.action ?? null;
    const hostnameMatches = !input.expectedHostname || hostname === input.expectedHostname;
    const actionMatches = !input.expectedAction || action === input.expectedAction;

    return {
      success: Boolean(payload.success) && hostnameMatches && actionMatches,
      challengeTimestamp: payload.challenge_ts ?? null,
      hostname,
      action,
      cdata: payload.cdata ?? null,
      errorCodes: [
        ...(payload['error-codes'] ?? []),
        ...(!hostnameMatches ? ['hostname-mismatch'] : []),
        ...(!actionMatches ? ['action-mismatch'] : []),
      ],
    };
  }
}

export function clientIpFromRequest(request: Request): string | null {
  return request.headers.get('CF-Connecting-IP');
}
