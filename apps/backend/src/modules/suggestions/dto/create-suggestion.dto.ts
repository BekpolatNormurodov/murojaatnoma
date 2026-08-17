import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * The worker-app posts a full `Suggestion.toJson()` draft (id/status/
 * created_at/votes included). Only title/body/category are used; the rest are
 * declared here purely so the global `forbidNonWhitelisted` pipe accepts them.
 */
export class CreateSuggestionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  created_at?: string;

  @IsOptional()
  @IsInt()
  votes?: number;
}
