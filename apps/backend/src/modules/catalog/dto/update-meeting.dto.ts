import { PartialType } from '@nestjs/swagger';
import { CreateMeetingDto } from './create-meeting.dto';

/** Body for `PATCH /meetings/:id` — every field from create is editable. */
export class UpdateMeetingDto extends PartialType(CreateMeetingDto) {}
