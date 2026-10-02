import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * An admin who may CHANGE data: SUPER_ADMIN or ADMIN. A VIEWER token only
 * reads — the web hides the buttons, this makes the API agree.
 */
@Injectable()
export class AdminWriterGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>().user;
    return (
      user?.scope === 'admin' &&
      (user.adminRole === AdminRole.SUPER_ADMIN || user.adminRole === AdminRole.ADMIN)
    );
  }
}
