import { PartialType } from '@nestjs/swagger';
import { CreateDocumentDto } from './create-document.dto';

/** Body for `PATCH /documents/:id` — every field from create is editable. */
export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}
