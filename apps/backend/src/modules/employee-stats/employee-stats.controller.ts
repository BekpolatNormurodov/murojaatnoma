import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { EmployeePeriodStats, EmployeeStatsService } from './employee-stats.service';

/**
 * Per-employee attendance stats over a date range (bu oy / o'tgan oy / oraliq).
 * web-admin only. Feeds the employee detail-drawer's "davr bo'yicha soat +
 * kechikish" panel.
 */
@ApiTags('employee-stats')
@ApiBearerAuth()
@RequireScope('admin')
@Controller('employee-stats')
export class EmployeeStatsController {
  constructor(private readonly stats: EmployeeStatsService) {}

  @Get(':id')
  @ApiOperation({ summary: "Bitta xodimning davr bo'yicha davomat statistikasi (from..to ISO)" })
  periodStats(
    @Param('id') id: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ): Promise<EmployeePeriodStats> {
    return this.stats.periodStats(id, from, to);
  }
}
