export class AppError extends Error {
  public readonly headers?: Record<string, string>;

  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    headers?: Record<string, string>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.headers = headers;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Not authenticated') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, headers?: Record<string, string>) {
    super(409, 'CONFLICT', message, headers);
  }
}
