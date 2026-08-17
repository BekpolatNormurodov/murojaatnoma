import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { LocationsService } from './locations.service';
import { TrackQueryDto } from './dto/track-query.dto';

/**
 * Admin-facing location views (web-admin live map + alerts). Restricted to
 * admin-scope tokens. Route order is safe: static /latest,/alerts,/stats are
 * one segment; /:employeeId/track is two, so they never shadow each other.
 */
@ApiTags('locations (admin)')
@ApiBearerAuth()
@RequireScope('admin')
@Controller('locations')
export class LocationsAdminController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('latest')
  @ApiOperation({ summary: 'Latest position of every active employee (live map)' })
  latest() {
    return this.locationsService.getLatestForAll();
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Employees with no location for > staleMinutes (or never)' })
  alerts() {
    return this.locationsService.getAlerts();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Location dashboard counters' })
  stats() {
    return this.locationsService.getStats();
  }

  @Get(':employeeId/track')
  @ApiOperation({ summary: 'Location history (track polyline) for one employee' })
  track(@Param('employeeId') employeeId: string, @Query() query: TrackQueryDto) {
    return this.locationsService.getTrack(employeeId, query);
  }
}
