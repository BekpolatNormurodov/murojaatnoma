import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AnalyticsService } from './analytics.service';
import { OverviewService } from './overview.service';
import { OverviewResponse } from './overview.types';
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
 * Admin-only (`@RequireScope('admin')`).
 */
@ApiTags('analytics')
@RequireScope('admin')
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly overviewService: OverviewService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Whole dashboard in one request — live murojaat/SLA/workforce/mahalla data' })
  overview(): Promise<OverviewResponse> {
    return this.overviewService.overview();
  }

  @Get('summary')
  @ApiOperation({ summary: 'Top-level dashboard summary counters' })
  summary(): Promise<SummaryResponse> {
    return this.analyticsService.summary();
  }

  @Get('kpi-trend')
  @ApiOperation({ summary: '12-month requests total/resolved trend line (live)' })
  async kpiTrend(): Promise<KpiPoint[]> {
    const { trend } = await this.overviewService.overview();
    return trend.monthly.map((p) => ({ label: p.label, total: p.created, resolved: p.resolved }));
  }

  @Get('category-distribution')
  @ApiOperation({ summary: 'Request counts grouped by category' })
  async categoryDistribution(): Promise<CategorySlice[]> {
    const { categories } = await this.overviewService.overview();
    return categories.map((c) => ({ category: c.category, value: c.total }));
  }

  @Get('region-stats')
  @ApiOperation({ summary: 'Request totals/resolved counts grouped by district' })
  regionStats(): Promise<RegionStat[]> {
    return this.analyticsService.regionStats();
  }

  @Get('hourly-activity')
  @ApiOperation({ summary: 'Request volume bucketed by hour of day (0-23)' })
  hourlyActivity(): Promise<HourlyActivityPoint[]> {
    return this.analyticsService.hourlyActivity();
  }

  @Get('district-loads')
  @ApiOperation({ summary: 'Per-district load levels for the live map' })
  districtLoads(): Promise<DistrictLoad[]> {
    return this.analyticsService.districtLoads();
  }
}
