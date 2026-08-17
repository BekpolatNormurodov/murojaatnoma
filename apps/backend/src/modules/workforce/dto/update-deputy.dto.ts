import { PartialType } from '@nestjs/swagger';
import { CreateDeputyDto } from './create-deputy.dto';

/** Body for `PATCH /deputies/:id` — every field from `CreateDeputyDto` is optional. */
export class UpdateDeputyDto extends PartialType(CreateDeputyDto) {}
