import type { ApiErrorCode, ApiResult } from '../api/contracts';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function jsonSuccess<T>(data: T, status = 200): Response {
  return jsonResponse<T>({ ok: true, data }, status);
}

export function jsonError(status: number, code: ApiErrorCode, message: string): Response {
  return jsonResponse<never>({ ok: false, error: { code, message } }, status);
}

function jsonResponse<T>(payload: ApiResult<T>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function readJsonBody<T>(request: Request, maxBytes = 32_768): Promise<T> {
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > maxBytes) {
    throw new HttpError(413, 'bad_request', 'Request body is too large.');
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new HttpError(413, 'bad_request', 'Request body is too large.');
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'bad_request', 'Invalid JSON body.');
  }
}
