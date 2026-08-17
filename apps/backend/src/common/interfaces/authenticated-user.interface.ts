import { AdminRole, EmployeeRole } from '@prisma/client';

/**
 * Distinguishes the two kinds of principals that can hold a valid access
 * token: mobile employees (phone + OTP / password) and web-admin users
 * (username + password). The `scope` claim lets guards tell them apart even
 * though both are signed with the same access secret.
 */
export type AuthScope = 'employee' | 'admin' | 'citizen';

/**
 * The role claim. Employees/admins carry a Prisma `EmployeeRole`; a citizen
 * (a phone with NO employee record, proven via OTP) carries the literal
 * `'CITIZEN'`. Because `'CITIZEN'` is never a member of `EmployeeRole[]`,
 * `RolesGuard` rejects it from every `@Roles(...)` route, and `scope:'citizen'`
 * makes `ScopeGuard` reject it from every `@RequireScope('employee'|'admin')`
 * route — so a citizen token only ever reaches JwtAuthGuard-only,
 * citizen-facing routes (e.g. their own applications, phone-scoped downstream).
 */
export type PrincipalRole = EmployeeRole | 'CITIZEN';

/** Shape attached to `Request.user` once the JWT strategy validates a token. */
export interface AuthenticatedUser {
  /** Subject id: employee id, or admin id when `scope === 'admin'`. */
  employeeId: string;
  phone: string;
  role: PrincipalRole;
  scope: AuthScope;
  adminRole?: AdminRole;
  username?: string;
}

/** Payload encoded inside access/refresh JWTs. */
export interface JwtPayload {
  sub: string;
  phone: string;
  role: PrincipalRole;
  /** Absent on legacy/employee tokens (treated as `'employee'`). */
  scope?: AuthScope;
  adminRole?: AdminRole;
  username?: string;
}
