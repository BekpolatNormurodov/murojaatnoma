import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { MediaMonitorController } from './media-monitor.controller';
import { MediaMonitorService } from './media-monitor.service';

@Module({
  imports: [PrismaModule],
  controllers: [MediaMonitorController],
  providers: [MediaMonitorService],
})
export class MediaMonitorModule {}
