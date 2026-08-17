import { Module } from '@nestjs/common';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

/**
 * Administrative zones (hudud): district + mahalla boundaries, GeoJSON, and
 * point-in-polygon lookups. Exports ZonesService so the locations module can
 * resolve a mahalla for each incoming GPS report.
 */
@Module({
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
