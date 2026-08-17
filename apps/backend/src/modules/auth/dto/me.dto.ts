import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeRole } from '@prisma/client';

/** Current authenticated employee profile, derived from the JWT subject. */
export class MeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  position!: string;

  @ApiProperty()
  region!: string;

  @ApiProperty()
  district!: string;

  @ApiProperty({ enum: EmployeeRole })
  role!: EmployeeRole;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl!: string | null;

  @ApiProperty({
    description: 'Whether the employee has at least one enrolled face template',
  })
  hasFace!: boolean;
}
