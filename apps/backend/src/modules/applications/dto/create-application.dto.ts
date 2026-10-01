import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationKind, Priority } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
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

  @ApiPropertyOptional({ enum: Priority, description: 'Muhimlik (SLA muddatini belgilaydi)' })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ example: "Mustaqillik ko'chasi, 12-uy" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ example: 41.3383 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: 69.3349 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({
    enum: ApplicationKind,
    description: 'ARIZA | SHIKOYAT — omitted: taken from the "[KIND|Category]" subject prefix',
  })
  @IsOptional()
  @IsEnum(ApplicationKind)
  kind?: ApplicationKind;

  @ApiPropertyOptional({ example: 'Kommunal' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @ApiPropertyOptional({
    description:
      "The citizen's enrolled face (from POST /applications/face). Kept only when it is " +
      'the face on file for applicantPhone — a murojaat cannot borrow someone else\'s face.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  applicantPhotoUrl?: string;
}
