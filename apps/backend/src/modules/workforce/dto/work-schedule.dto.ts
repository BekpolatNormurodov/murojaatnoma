import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsInt, IsString } from 'class-validator';

/**
 * Mirrors `WorkSchedule` from web-admin/src/shared/data/types.ts — stored in
 * `Staff.schedule` (a Prisma `Json` column).
 */
export class WorkScheduleDto {
  @ApiProperty({ example: '09:00' })
  @IsString()
  start!: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  end!: string;

  @ApiProperty({ type: [Number], description: '1=Dushanba ... 7=Yakshanba' })
  @IsArray()
  @IsInt({ each: true })
  days!: number[];
}
