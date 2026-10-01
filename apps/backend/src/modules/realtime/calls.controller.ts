import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CallLog } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CallsService } from './calls.service';

/** Same routing id the realtime gateway uses for every admin. */
const ADMIN_ID = 'me';

/**
 * Call history for the call-log UI (missed / incoming / outgoing badges).
 * Authenticated and self-scoped: an employee only ever gets their OWN calls;
 * an admin gets the shared admin ('me') log, or any user's via `userId`.
 * (Was `@Public` with a `userId` query — anyone could read anyone's call log.)
 */
@ApiTags('calls')
@ApiBearerAuth()
@RequireScope('admin', 'employee')
@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Get()
  @ApiOperation({ summary: "Qo'ng'iroqlar tarixi (o'z qo'ng'iroqlari; admin — istalgan userId)" })
  @ApiQuery({ name: 'userId', required: false, description: "Faqat admin uchun. Default 'me'" })
  @ApiQuery({ name: 'limit', required: false })
  history(
    @CurrentUser() user: AuthenticatedUser,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ): Promise<CallLog[]> {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const target = user.scope === 'admin' ? (userId ?? ADMIN_ID) : user.employeeId;
    return this.calls.history(target, Number.isFinite(parsedLimit) ? parsedLimit : 50);
  }
}
