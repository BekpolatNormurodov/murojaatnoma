import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/** Body for PATCH /chat/conversations/:id/archive. */
export class ArchiveConversationDto {
  @ApiProperty({ description: 'true = move to Archive, false = restore to main list' })
  @IsBoolean()
  archived!: boolean;
}
