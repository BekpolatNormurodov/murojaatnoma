import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { EmployeeStatsController } from './employee-stats.controller';
import { EmployeeStatsService } from './employee-stats.service';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeStatsController],
  providers: [EmployeeStatsService],
})
export class EmployeeStatsModule {}
