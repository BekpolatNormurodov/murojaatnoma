import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Mirrors `WorkerDocument` from web-admin/src/shared/data/types.ts — a
 * single entry inside `Worker.documents` (a Prisma `Json` column).
 */
export class WorkerDocumentDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: ['passport', 'contract', 'certificate', 'license', 'medical'] })
  @IsIn(['passport', 'contract', 'certificate', 'license', 'medical'])
  type!: 'passport' | 'contract' | 'certificate' | 'license' | 'medical';

  @ApiProperty({ enum: ['valid', 'expiring', 'expired'] })
  @IsIn(['valid', 'expiring', 'expired'])
  status!: 'valid' | 'expiring' | 'expired';

  @ApiProperty({ description: 'ISO date' })
  @IsString()
  uploadedAt!: string;

  @ApiPropertyOptional({ description: 'ISO date' })
  @IsOptional()
  @IsString()
  expiresAt?: string;
}
