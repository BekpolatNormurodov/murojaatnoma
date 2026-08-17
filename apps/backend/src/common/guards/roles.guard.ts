import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmployeeRole } from '@prisma/client';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Authorizes a request based on the roles declared via `@Roles(...)`.
 * Must run after `JwtAuthGuard` so `request.user` is populated.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<EmployeeRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();

    return !!request.user && requiredRoles.includes(request.user.role);
  }
}
