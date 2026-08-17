import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Logs method, path, status code and duration for every HTTP request.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();
    const { method, originalUrl } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            `${method} ${originalUrl} ${response.statusCode} +${duration}ms`,
          );
        },
        error: (err: Error) => {
          const duration = Date.now() - start;
          this.logger.warn(
            `${method} ${originalUrl} failed (${err.message}) +${duration}ms`,
          );
        },
      }),
    );
  }
}
