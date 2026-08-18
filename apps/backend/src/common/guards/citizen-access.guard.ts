import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_CITIZEN_KEY } from '../decorators/allow-citizen.decorator';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Secure-by-default gate for CITIZEN-scope principals.
 *
 * A citizen token (`scope: 'citizen'`, `role: 'CITIZEN'`) is allowed to reach
 * ONLY routes explicitly opted-in with `@AllowCitizen()`; every other
 * authenticated route denies it. This closes the "any authenticated principal
 * reaches a JwtAuthGuard-only route" hole (e.g. `GET /employees` leaking the
 * staff roster) that a citizen token would otherwise open.
 *
 * Non-citizen principals (employee/admin) and unauthenticated `@Public` routes
 * (where `request.user` is undefined) are entirely unaffected — this guard only
 * ever narrows access for the `'citizen'` scope, never widens it. Registered as
 * a global `APP_GUARD` AFTER `JwtAuthGuard`, so `request.user` is already set.
 */
@Injectable()
export class CitizenAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();

    // Only citizens are gated here. Employees/admins and unauthenticated
    // (@Public) requests pass straight through.
    if (request.user?.scope !== 'citizen') {
      return true;
    }

    const allowed = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOW_CITIZEN_KEY,
      [context.getHandler(), context.getClass()],
    );
    return allowed === true;
  }
}
