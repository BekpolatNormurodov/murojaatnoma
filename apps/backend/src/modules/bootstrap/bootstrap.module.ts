import { Module } from '@nestjs/common';
import { ZonesModule } from '../zones/zones.module';
import { BootstrapService } from './bootstrap.service';

/**
 * Boot-time idempotent seeding (zones + admin + optional demo data). Imports
 * ZonesModule so it can refresh the zone cache after seeding.
 */
@Module({
  imports: [ZonesModule],
  providers: [BootstrapService],
})
export class BootstrapModule {}
