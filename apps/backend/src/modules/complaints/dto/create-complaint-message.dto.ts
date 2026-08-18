import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Body for `POST /complaints/:id/messages` (multipart/form-data). Both fields
 * are text parts alongside the optional binary `file` part; the file itself is
 * read via `@UploadedFile()`, not this DTO.
 */
export class CreateComplaintMessageDto {
  @ApiPropertyOptional({ description: 'Message body (optional when a file is attached)' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ description: 'Defaults to "Administrator" when omitted' })
  @IsOptional()
  @IsString()
  authorName?: string;
}
