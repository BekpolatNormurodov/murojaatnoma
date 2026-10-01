import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { OverviewService } from './overview.service';
import { ZonesModule } from '../zones/zones.module';

@Module({
  imports: [ZonesModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, OverviewService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
