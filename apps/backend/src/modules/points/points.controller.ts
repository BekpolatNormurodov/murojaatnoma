import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { PointsService } from './points.service';

/** Employee points/rating (worker-app "Ball nazorati"). */
@ApiTags('points')
@ApiBearerAuth()
@RequireScope('employee')
@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('me')
  @ApiOperation({ summary: 'My points: total, rank, recent history' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.pointsService.getMe(user.employeeId);
  }

  @Get('me/history')
  @ApiOperation({ summary: 'My full points history' })
  history(@CurrentUser() user: AuthenticatedUser) {
    return this.pointsService.getHistory(user.employeeId);
  }
}
