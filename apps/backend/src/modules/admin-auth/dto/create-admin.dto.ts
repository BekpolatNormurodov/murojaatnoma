import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdminRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

/** Payload to create a new web-admin account (super-admin only). */
export class CreateAdminDto {
  @ApiProperty({ example: 'operator1' })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: '••••••••' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Ism Familiya' })
  @IsString()
  fullName!: string;

  @ApiPropertyOptional({ example: 'operator1@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ enum: AdminRole, example: AdminRole.ADMIN })
  @IsEnum(AdminRole)
  role!: AdminRole;
}
