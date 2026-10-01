import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EmployeeStatsController } from './employee-stats.controller';
import { EmployeeStatsService } from './employee-stats.service';
import { MyDashboardController } from './my-dashboard.controller';
import { MyDashboardService } from './my-dashboard.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [PrismaModule, ChatModule],
  controllers: [EmployeeStatsController, MyDashboardController],
  providers: [EmployeeStatsService, MyDashboardService],
})
export class EmployeeStatsModule {}
