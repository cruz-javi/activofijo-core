import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { DomainError } from '../../../../shared/domain/domain-error.js';

export function mapearErrorDominio(error: DomainError | null): HttpException {
  const mensaje = error?.message ?? 'No fue posible completar la operación';

  switch (error?.errorCode) {
    case 'UNAUTHORIZED':
      return new UnauthorizedException(mensaje);
    case 'FORBIDDEN':
      return new ForbiddenException(mensaje);
    case 'NOT_FOUND':
      return new NotFoundException(mensaje);
    case 'CONFLICT':
      return new ConflictException(mensaje);
    case 'VALIDATION_ERROR':
      return new BadRequestException(mensaje);
    default:
      return new InternalServerErrorException(mensaje);
  }
}
