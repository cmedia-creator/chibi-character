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
      return failureResult(['invalid-input-response']);
    }

    const body = new URLSearchParams({
      secret: this.secret,
      response: input.token,
    });
    if (input.remoteIp) body.set('remoteip', input.remoteIp);
    if (input.idempotencyKey) body.set('idempotency_key', input.idempotencyKey);

    try {
      const response = await this.fetcher(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        console.error('Turnstile Siteverify HTTP error', response.status);
        return failureResult([`siteverify-http-${response.status}`]);
      }

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
    } catch (error) {
      console.error('Turnstile Siteverify request failed', error);
      return failureResult(['siteverify-request-failed']);
    }
  }
}

export function clientIpFromRequest(request: Request): string | null {
  return request.headers.get('CF-Connecting-IP');
}

function failureResult(errorCodes: string[]): TurnstileVerificationResult {
  return {
    success: false,
    challengeTimestamp: null,
    hostname: null,
    action: null,
    cdata: null,
    errorCodes,
  };
}
