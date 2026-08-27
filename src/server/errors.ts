export class RepositoryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryConflictError';
  }
}

export class RepositoryForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryForbiddenError';
  }
}
