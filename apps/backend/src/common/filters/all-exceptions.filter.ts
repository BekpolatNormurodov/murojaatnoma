import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { resolveLang } from '../i18n/lang.util';
import { localizeValidationErrors } from '../i18n/validation-messages';
import { isValidationExceptionPayload } from '../i18n/validation-exception.types';

interface ErrorResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string | string[];
  error?: string;
}

/**
 * Normalizes every unhandled error (HttpException or otherwise) into a
 * consistent JSON envelope, and logs 5xx responses server-side.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode: number = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : undefined;

    // The global ValidationPipe's exceptionFactory (main.ts) throws a
    // BadRequestException whose body preserves structured, per-field
    // class-validator errors instead of English strings. Detect that shape
    // here and localize it into the caller's language; every other
    // exception (including plain BadRequestExceptions thrown by app code)
    // falls through to the unchanged default handling below.
    const message = isValidationExceptionPayload(exceptionResponse)
      ? localizeValidationErrors(exceptionResponse.validationErrors, resolveLang(request))
      : this.extractMessage(exceptionResponse, exception);
    const error = isHttpException ? exception.name : 'InternalServerError';

    const body: ErrorResponseBody = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
      error,
    };

    if (statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${request.method} ${request.url} -> ${statusCode}`, stack);
    }

    response.status(statusCode).json(body);
  }

  private extractMessage(
    exceptionResponse: unknown,
    exception: unknown,
  ): string | string[] {
    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      return (exceptionResponse as { message: string | string[] }).message;
    }
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }
    if (exception instanceof Error) {
      return exception.message;
    }
    return 'Internal server error';
  }
}
