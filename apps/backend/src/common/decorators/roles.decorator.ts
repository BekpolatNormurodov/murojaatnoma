import { SetMetadata } from '@nestjs/common';
import { EmployeeRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Marks a route (or controller) as requiring one of the given employee roles.
 * Must be combined with `JwtAuthGuard` + `RolesGuard`.
 */
export const Roles = (...roles: EmployeeRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
