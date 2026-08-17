import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMsgKind } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateChatMessageDto {
  @ApiPropertyOptional({
    description: 'Sender id — "me" (the admin) or a staff id. Defaults to "me".',
    default: 'me',
  })
  @IsOptional()
  @IsString()
  senderId?: string;

  @ApiProperty({ enum: ChatMsgKind })
  @IsEnum(ChatMsgKind)
  kind!: ChatMsgKind;

  @ApiPropertyOptional({
    description: 'Text body (required for kind=text; optional caption otherwise)',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  text?: string;

  @ApiPropertyOptional({ description: 'Original file name (image/file)' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ description: 'File size in bytes (image/file)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @ApiPropertyOptional({
    description: 'Object/URL of the attached image, file or voice note',
  })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional({ description: 'Voice message duration, seconds' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSec?: number;
}
