import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { MyDashboard, MyDashboardService } from './my-dashboard.service';

/** Employee's own Home dashboard (worker-app) — self-scoped, one request. */
@ApiTags('employee-stats')
@ApiBearerAuth()
@RequireScope('employee')
@Controller('me')
export class MyDashboardController {
  constructor(private readonly dashboard: MyDashboardService) {}

  @Get('dashboard')
  @ApiOperation({
    summary:
      "Xodimning bosh sahifasi: davomat (o'z vaqtida %, 30 kun, reyting), murojaatlar, oylik/premya, bugun, so'nggi faollik",
  })
  get(@CurrentUser() user: AuthenticatedUser): Promise<MyDashboard> {
    return this.dashboard.build(user.employeeId);
  }
}
