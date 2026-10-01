import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

/** Citizen rating of a resolved murojaat. */
export class RateApplicationDto {
  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Baho 1 dan 5 gacha' })
  @Max(5, { message: 'Baho 1 dan 5 gacha' })
  rating!: number;

  @ApiPropertyOptional({ example: 'Tez hal qilindi, rahmat!' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

/** Citizen reopens a resolved murojaat. */
export class ReopenApplicationDto {
  @ApiProperty({ example: "Chiroq hali ham yonmayapti" })
  @IsString()
  @MinLength(3, { message: 'Sababni yozing (kamida 3 harf)' })
  @MaxLength(500)
  reason!: string;
}
