import { PartialType } from '@nestjs/swagger';
import { CreateBonusDto } from './create-bonus.dto';

/**
 * Body for `PATCH /bonuses/:id` (web-admin "Premyani tahrirlash"). Every field
 * from {@link CreateBonusDto} becomes optional; only the sent fields are
 * updated. `employeeId`/`workerId` may be sent as `null` to clear them (e.g.
 * when the admin switches the recipient to a free-text name).
 */
export class UpdateBonusDto extends PartialType(CreateBonusDto) {}
