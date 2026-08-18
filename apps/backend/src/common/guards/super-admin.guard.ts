import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Narrows an already-authenticated admin route to SUPER_ADMIN principals only.
 *
 * Runs after the global `JwtAuthGuard` (which populates `request.user`) and is
 * meant to sit alongside class-level `@RequireScope('admin')`: the scope proves
 * an admin token, this guard proves that admin is a super-admin. Returning
 * `false` yields a plain 403 — no custom exception is thrown.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    return user?.scope === 'admin' && user?.adminRole === AdminRole.SUPER_ADMIN;
  }
}
