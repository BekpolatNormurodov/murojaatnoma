import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class VerifyFaceDto {
  @ApiPropertyOptional({
    example: 'a3f5c9e0-...-employee-id',
    description:
      'Employee to match against. Normally resolved server-side from the authenticated ' +
      'caller and ignored when present; an ADMIN-scoped caller may override it.',
  })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({
    type: [Number],
    description: 'Live face-recognition embedding to match against enrolled templates',
    example: [0.0123, -0.0456, 0.0789],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  embedding!: number[];
}
