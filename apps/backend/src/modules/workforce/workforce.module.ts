import { Module } from '@nestjs/common';
import { DeputiesController } from './deputies.controller';
import { DeputiesService } from './deputies.service';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { WorkersController } from './workers.controller';
import { WorkersService } from './workers.service';

/**
 * Workforce profile lists for the web-admin panel: field workers, staff
 * (RBAC users), and deputy governors. Attendance/check-in logic is owned by
 * another module — this one only serves the profile shapes 1:1 with
 * `apps/web-admin/src/shared/data/mock.ts` (`Worker`, `StaffMember`, `Deputy`).
 */
@Module({
  controllers: [WorkersController, StaffController, DeputiesController],
  providers: [WorkersService, StaffService, DeputiesService],
  exports: [WorkersService, StaffService, DeputiesService],
})
export class WorkforceModule {}
