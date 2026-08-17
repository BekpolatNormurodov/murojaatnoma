import { PartialType } from '@nestjs/swagger';
import { CreateWorkerDto } from './create-worker.dto';

/** Body for `PATCH /workers/:id` — every field from `CreateWorkerDto` is optional. */
export class UpdateWorkerDto extends PartialType(CreateWorkerDto) {}
