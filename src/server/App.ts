import type { SaveCharacterRequest, SaveProfileRequest } from '../api/contracts';
import { validateProfileSlug } from '../profile/slug';
import { RepositoryConflictError, RepositoryForbiddenError } from './errors';
import { HttpError, jsonError, jsonSuccess, readJsonBody } from './http';
import type { ServerRepository } from './Repository';
import { resolveSessionUserId } from './session';
import { validateSaveCharacterRequest, validateSaveProfileRequest } from './validation';

export class ServerApp {
  constructor(private readonly repository: ServerRepository) {}

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const now = Date.now();

    try {
      if (request.method === 'GET' && url.pathname === '/api/me') {
        const userId = await resolveSessionUserId(this.repository, request, now);
        return jsonSuccess({ userId: userId ?? '', authenticated: Boolean(userId) });
      }

      if (url.pathname === '/api/characters') {
        const userId = await this.requireUser(request, now);
        if (request.method === 'GET') {
          const characters = await this.repository.listCharacters(userId);
          return jsonSuccess({ characters });
        }
        if (request.method === 'PUT') {
          const raw = await readJsonBody<SaveCharacterRequest>(request);
          const input = validateSaveCharacterRequest(raw);
          return jsonSuccess(await this.repository.saveCharacter(userId, input, now));
        }
        return this.methodNotAllowed();
      }

      if (url.pathname === '/api/profile') {
        const userId = await this.requireUser(request, now);
        if (request.method === 'GET') {
          const profile = await this.repository.getProfile(userId);
          return jsonSuccess({ profile });
        }
        if (request.method === 'PUT') {
          const raw = await readJsonBody<SaveProfileRequest>(request);
          const input = validateSaveProfileRequest(raw);
          return jsonSuccess(await this.repository.saveProfile(userId, input, now));
        }
        return this.methodNotAllowed();
      }

      if (request.method === 'GET' && url.pathname === '/api/entitlements') {
        const userId = await this.requireUser(request, now);
        return jsonSuccess(await this.repository.getEntitlements(userId));
      }

      if (url.pathname.startsWith('/api/public/')) {
        if (request.method !== 'GET') return this.methodNotAllowed();
        const rawSlug = url.pathname.slice('/api/public/'.length);
        const validation = validateProfileSlug(rawSlug);
        if (!validation.ok) throw new HttpError(404, 'not_found', 'Profile not found.');
        const profile = await this.repository.getPublicProfile(validation.slug);
        if (!profile) throw new HttpError(404, 'not_found', 'Profile not found.');
        return jsonSuccess(profile);
      }

      return jsonError(404, 'not_found', 'API route not found.');
    } catch (error) {
      return this.handleError(error);
    }
  }

  private async requireUser(request: Request, now: number): Promise<string> {
    const userId = await resolveSessionUserId(this.repository, request, now);
    if (!userId) throw new HttpError(401, 'unauthorized', 'Authentication required.');
    return userId;
  }

  private methodNotAllowed(): Response {
    return jsonError(405, 'bad_request', 'Method not allowed.');
  }

  private handleError(error: unknown): Response {
    if (error instanceof HttpError) return jsonError(error.status, error.code, error.message);
    if (error instanceof RepositoryConflictError) return jsonError(409, 'conflict', error.message);
    if (error instanceof RepositoryForbiddenError) return jsonError(403, 'forbidden', error.message);
    console.error('Unhandled API error', error);
    return jsonError(500, 'internal_error', 'Internal server error.');
  }
}
