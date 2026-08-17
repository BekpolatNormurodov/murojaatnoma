import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AnalyticsService } from './analytics.service';
import {
  CategorySlice,
  DistrictLoad,
  HourlyActivityPoint,
  KpiPoint,
  RegionStat,
  SummaryResponse,
} from './analytics.types';

/**
 * Dashboard + analytics ("hisobot") endpoints for the web-admin panel.
 *
 * NOTE: all routes here are `@Public()` for now. The web-admin dashboard
 * doesn't have its auth wired up yet, so gating these behind an admin guard
 * (see `admin-auth` module) is a later step.
 */
@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Public()
  @Get('summary')
  @ApiOperation({ summary: 'Top-level dashboard summary counters' })
  summary(): Promise<SummaryResponse> {
    return this.analyticsService.summary();
  }

  @Public()
  @Get('kpi-trend')
  @ApiOperation({ summary: '12-month requests total/resolved trend line' })
  kpiTrend(): KpiPoint[] {
    return this.analyticsService.kpiTrend();
  }

  @Public()
  @Get('category-distribution')
  @ApiOperation({ summary: 'Request counts grouped by category' })
  categoryDistribution(): Promise<CategorySlice[]> {
    return this.analyticsService.categoryDistribution();
  }

  @Public()
  @Get('region-stats')
  @ApiOperation({ summary: 'Request totals/resolved counts grouped by district' })
  regionStats(): Promise<RegionStat[]> {
    return this.analyticsService.regionStats();
  }

  @Public()
  @Get('hourly-activity')
  @ApiOperation({ summary: 'Request volume bucketed by hour of day (0-23)' })
  hourlyActivity(): Promise<HourlyActivityPoint[]> {
    return this.analyticsService.hourlyActivity();
  }

  @Public()
  @Get('district-loads')
  @ApiOperation({ summary: 'Per-district load levels for the live map' })
  districtLoads(): Promise<DistrictLoad[]> {
    return this.analyticsService.districtLoads();
  }
}
