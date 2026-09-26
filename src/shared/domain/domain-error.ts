export abstract class DomainError extends Error {
  public readonly errorCode: string;

  constructor(message: string, errorCode: string) {
    super(message);
    this.name = this.constructor.name;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 'NOT_FOUND');
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'No autorizado') {
    super(message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = 'Acceso denegado') {
    super(message, 'FORBIDDEN');
  }
}
