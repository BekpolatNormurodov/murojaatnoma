import { PartialType } from '@nestjs/swagger';
import { CreateCameraDto } from './create-camera.dto';

/** Body for `PATCH /cameras/:id` — every field from create is editable. */
export class UpdateCameraDto extends PartialType(CreateCameraDto) {}
