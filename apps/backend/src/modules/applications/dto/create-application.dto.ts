import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { E164_PHONE_REGEX } from '../../../common/constants/validation.constants';

export class CreateApplicationDto {
  @ApiProperty({ example: 'Aliyeva Nodira' })
  @IsString()
  @MinLength(3)
  applicantFullName!: string;

  @ApiProperty({ example: '+998901234567' })
  @Matches(E164_PHONE_REGEX, {
    message: 'applicantPhone must be a valid E.164 phone number',
  })
  applicantPhone!: string;

  @ApiProperty({ example: 'Kocha yoritilmayapti' })
  @IsString()
  @MinLength(3)
  subject!: string;

  @ApiProperty({ example: 'Bizning ko’chada bir haftadan beri chiroqlar yonmayapti.' })
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiPropertyOptional({ example: 'Toshkent shahri' })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({ example: 'Yunusobod tumani' })
  @IsOptional()
  @IsString()
  district?: string;
}
