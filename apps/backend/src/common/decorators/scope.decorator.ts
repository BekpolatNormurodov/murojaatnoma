import { SetMetadata } from '@nestjs/common';
import { AuthScope } from '../interfaces/authenticated-user.interface';

export const SCOPE_KEY = 'authScope';

/**
 * Restricts a route (or controller) to one or more principal scopes.
 * `@RequireScope('admin')` = web-admin tokens only;
 * `@RequireScope('employee')` = mobile employee tokens only.
 * Must be combined with the global `JwtAuthGuard` + `ScopeGuard`.
 */
export const RequireScope = (...scopes: AuthScope[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(SCOPE_KEY, scopes);
