import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageSenderRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateMessageDto {
  @ApiProperty({ enum: MessageSenderRole, example: MessageSenderRole.CITIZEN })
  @IsEnum(MessageSenderRole)
  senderRole!: MessageSenderRole;

  @ApiPropertyOptional({ example: 'Aliyeva Nodira' })
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiProperty({ example: 'Muammo hali ham hal qilinmadi.' })
  @IsString()
  @MinLength(1)
  text!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/uploads/photo.jpg' })
  @IsOptional()
  @IsUrl()
  attachmentUrl?: string;
}
