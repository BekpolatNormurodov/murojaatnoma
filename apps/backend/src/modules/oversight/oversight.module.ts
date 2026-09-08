import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { LocationsModule } from '../locations/locations.module';
import { SalariesModule } from '../salaries/salaries.module';
import { OversightController } from './oversight.controller';
import { OversightService } from './oversight.service';

@Module({
  imports: [PrismaModule, AttendanceModule, LocationsModule, SalariesModule],
  controllers: [OversightController],
  providers: [OversightService],
})
export class OversightModule {}
