import { EmployeeRole } from '@prisma/client';

/** Shape attached to `Request.user` once the JWT strategy validates a token. */
export interface AuthenticatedUser {
  employeeId: string;
  phone: string;
  role: EmployeeRole;
}

/** Payload encoded inside access/refresh JWTs. */
export interface JwtPayload {
  sub: string;
  phone: string;
  role: EmployeeRole;
}
