import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/** Body for `POST /complaints/:id/response` — append an official reply. */
export class CreateComplaintResponseDto {
  @ApiProperty()
  @IsString()
  text!: string;

  @ApiPropertyOptional({ description: 'Defaults to "Hokimiyat" when omitted' })
  @IsOptional()
  @IsString()
  author?: string;
}
