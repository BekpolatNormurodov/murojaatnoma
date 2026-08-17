import { PartialType } from '@nestjs/swagger';
import { CreateStaffDto } from './create-staff.dto';

/** Body for `PATCH /staff/:id` — every field from `CreateStaffDto` is optional. */
export class UpdateStaffDto extends PartialType(CreateStaffDto) {}
