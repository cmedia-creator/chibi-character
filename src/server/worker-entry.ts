import { AuthHttpApp } from './AuthHttpApp';
import { D1Repository } from './D1Repository';
import { ServerApp } from './App';
import type { WorkerBindings } from './cloudflare';
import { jsonError } from './http';

const worker = {
  async fetch(request: Request, env: WorkerBindings): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      if (!env.DB) {
        return jsonError(503, 'internal_error', 'Database binding is not configured.');
      }

      if (url.pathname.startsWith('/api/auth/')) {
        return new AuthHttpApp(
          env.DB,
          env.TURNSTILE_SECRET,
          env.PASSWORD_PEPPER,
        ).handle(request);
      }

      return new ServerApp(new D1Repository(env.DB)).handle(request);
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};

export default worker;
