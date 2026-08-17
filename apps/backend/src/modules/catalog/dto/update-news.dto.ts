import { PartialType } from '@nestjs/swagger';
import { CreateNewsDto } from './create-news.dto';

/** Body for `PATCH /news/:id` — every field from create is editable. */
export class UpdateNewsDto extends PartialType(CreateNewsDto) {}
