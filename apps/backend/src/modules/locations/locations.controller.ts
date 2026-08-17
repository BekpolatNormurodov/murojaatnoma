import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateLocationBatchDto } from './dto/create-location-batch.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { LocationsService } from './locations.service';

/**
 * Employee-facing location endpoints (mobile worker-app). The device reports
 * its position continuously; when offline it buffers and flushes via /batch.
 */
@ApiTags('locations')
@ApiBearerAuth()
@RequireScope('employee')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Report current location' })
  report(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLocationDto) {
    return this.locationsService.ingest(user.employeeId, dto);
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Flush buffered (offline) locations, oldest-first' })
  reportBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLocationBatchDto,
  ) {
    return this.locationsService.ingestBatch(user.employeeId, dto.items);
  }

  @Get('me')
  @ApiOperation({ summary: 'My last known location' })
  myLatest(@CurrentUser() user: AuthenticatedUser) {
    return this.locationsService.getMyLatest(user.employeeId);
  }
}
