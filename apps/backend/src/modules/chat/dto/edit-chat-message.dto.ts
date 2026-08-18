import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Body for editing a message — only the text is editable, and only while the
 * message is still unread (enforced in ChatService). */
export class EditChatMessageDto {
  @ApiProperty({ description: 'New text body' })
  @IsString()
  @MinLength(1)
  text!: string;
}
