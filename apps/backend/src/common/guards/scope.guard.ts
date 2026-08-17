import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPE_KEY } from '../decorators/scope.decorator';
import { AuthScope, AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Authorizes a request based on the principal scope declared via
 * `@RequireScope(...)`. Runs after `JwtAuthGuard` so `request.user` is set.
 * Routes without `@RequireScope` are unaffected.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<AuthScope[] | undefined>(
      SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

    return !!request.user && requiredScopes.includes(request.user.scope);
  }
}
