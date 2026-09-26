import { PipeTransform, ArgumentMetadata, BadRequestException, Injectable } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const targetSchema = this.schema;
    if (!targetSchema) {
      return value;
    }

    const result = targetSchema.safeParse(value);
    if (!result.success) {
      const issues = (result.error as ZodError).issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
        code: i.code,
      }));

      throw new BadRequestException({
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: issues,
      });
    }

    return result.data;
  }
}
