import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/** Web-admin login credentials (username + password). */
export class AdminLoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @MinLength(3)
  username!: string;

  @ApiProperty({ example: '••••••••' })
  @IsString()
  @MinLength(6)
  password!: string;
}
