import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Extracts the authenticated employee (set by `JwtAuthGuard`) from the
 * request. Usage: `@CurrentUser() user: AuthenticatedUser`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
