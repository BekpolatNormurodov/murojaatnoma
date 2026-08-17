import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

/** Body for a staff (employee/admin) reply on an application's chat thread. */
export class ReplyApplicationDto {
  @ApiProperty({ example: 'Murojaatingiz ko‘rib chiqilmoqda, tez orada javob beramiz.' })
  @IsString()
  @MinLength(1)
  text!: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/uploads/photo.jpg' })
  @IsOptional()
  @IsUrl()
  attachmentUrl?: string;
}
