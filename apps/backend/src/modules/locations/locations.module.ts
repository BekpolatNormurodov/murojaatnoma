import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ZonesModule } from '../zones/zones.module';
import { LocationStaleService } from './location-stale.service';
import { LocationsAdminController } from './locations-admin.controller';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

/**
 * Continuous employee location tracking (doimiy lokatsiya): ingest + offline
 * batch flush, admin live map / track / alerts, and the stale-location cron.
 * Depends on ZonesModule to resolve each report's mahalla + district, and on
 * NotificationsModule to tell an employee that their territory changed.
 */
@Module({
  imports: [ZonesModule, NotificationsModule],
  controllers: [LocationsController, LocationsAdminController],
  providers: [LocationsService, LocationStaleService],
  exports: [LocationsService],
})
export class LocationsModule {}
