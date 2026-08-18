import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Employee (worker-app) credential login. Employees authenticate with a
 * username + password (bcrypt), unlike citizens who use phone + OTP.
 */
export class EmployeeLoginDto {
  @ApiProperty({ example: 'aziz', description: 'Xodim login (foydalanuvchi nomi)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: 'Xodim2026!', description: 'Xodim paroli' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}
