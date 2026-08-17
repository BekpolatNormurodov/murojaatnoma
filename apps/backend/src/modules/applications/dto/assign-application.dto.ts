import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Routes ("aylantirish") an application to an employee and/or a department.
 * At least one of `assignedEmployeeId` / `assignedDepartmentId` must be
 * provided — enforced in the service, not here, since class-validator has no
 * built-in "at least one of" cross-field rule worth adding a custom
 * decorator for.
 */
export class AssignApplicationDto {
  @ApiPropertyOptional({ description: 'Employee id to assign the application to' })
  @IsOptional()
  @IsString()
  assignedEmployeeId?: string;

  @ApiPropertyOptional({ description: 'Department id to route the application to' })
  @IsOptional()
  @IsString()
  assignedDepartmentId?: string;

  @ApiPropertyOptional({ example: 'Iltimos, tezkor ko‘rib chiqing.' })
  @IsOptional()
  @IsString()
  note?: string;
}
