import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttachmentType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateAttachmentDto {
  @ApiProperty({ enum: AttachmentType, example: AttachmentType.PHOTO })
  @IsEnum(AttachmentType)
  type!: AttachmentType;

  @ApiProperty({ example: 'https://cdn.example.com/uploads/evidence.jpg' })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ example: 'evidence.jpg' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ example: 245_760 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}
