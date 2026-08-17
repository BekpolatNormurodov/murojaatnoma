import { Module } from '@nestjs/common';
import { ZonesModule } from '../zones/zones.module';
import { LocationStaleService } from './location-stale.service';
import { LocationsAdminController } from './locations-admin.controller';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

/**
 * Continuous employee location tracking (doimiy lokatsiya): ingest + offline
 * batch flush, admin live map / track / alerts, and the stale-location cron.
 * Depends on ZonesModule to resolve each report's mahalla + district.
 */
@Module({
  imports: [ZonesModule],
  controllers: [LocationsController, LocationsAdminController],
  providers: [LocationsService, LocationStaleService],
  exports: [LocationsService],
})
export class LocationsModule {}
