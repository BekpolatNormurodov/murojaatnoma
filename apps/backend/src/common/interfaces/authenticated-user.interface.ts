import { AdminRole, EmployeeRole } from '@prisma/client';

/**
 * Distinguishes the two kinds of principals that can hold a valid access
 * token: mobile employees (phone + OTP / password) and web-admin users
 * (username + password). The `scope` claim lets guards tell them apart even
 * though both are signed with the same access secret.
 */
export type AuthScope = 'employee' | 'admin';

/** Shape attached to `Request.user` once the JWT strategy validates a token. */
export interface AuthenticatedUser {
  /** Subject id: employee id, or admin id when `scope === 'admin'`. */
  employeeId: string;
  phone: string;
  role: EmployeeRole;
  scope: AuthScope;
  adminRole?: AdminRole;
  username?: string;
}

/** Payload encoded inside access/refresh JWTs. */
export interface JwtPayload {
  sub: string;
  phone: string;
  role: EmployeeRole;
  /** Absent on legacy/employee tokens (treated as `'employee'`). */
  scope?: AuthScope;
  adminRole?: AdminRole;
  username?: string;
}
