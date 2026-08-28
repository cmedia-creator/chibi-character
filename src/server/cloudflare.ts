export interface D1Result<T = unknown> {
  success: boolean;
  results?: T[];
  meta?: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface FetcherBinding {
  fetch(request: Request): Promise<Response>;
}

export interface R2BucketBinding {
  get(key: string): Promise<unknown>;
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob, options?: unknown): Promise<unknown>;
  delete(key: string): Promise<void>;
}

export interface WorkerBindings {
  DB?: D1Database;
  ASSETS?: FetcherBinding;
  SHARE_ASSETS?: R2BucketBinding;
  TURNSTILE_SECRET?: string;
  PASSWORD_PEPPER?: string;
}
