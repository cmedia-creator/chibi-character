# Password auth friction change

MVP password authentication no longer requires a visible Turnstile challenge.

## User experience

- Login: ID + password
- Registration: ID + password + one-time recovery code output
- Recovery: ID + recovery code + new password
- No Face ID / Passkey requirement
- No visible CAPTCHA / Turnstile requirement

## Abuse protection

D1-backed, server-side rate limits keyed by an HMAC of the Cloudflare client IP:

- registration: 10 attempts / hour
- login: 60 attempts / 15 minutes
- recovery: 10 attempts / hour

The raw client IP is not stored in D1.

Turnstile remains available for legacy Passkey and future protected surfaces, but it is no longer a dependency of the MVP password account flow.
