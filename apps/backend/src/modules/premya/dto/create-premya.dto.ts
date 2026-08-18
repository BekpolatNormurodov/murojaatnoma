import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreatePremyaDto {
  @ApiPropertyOptional({
    example: 500000,
    description: "So'ralayotgan mukofot summasi (so'mda). Ixtiyoriy.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @ApiProperty({ example: 'Oylik reja 120% bajarildi' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
