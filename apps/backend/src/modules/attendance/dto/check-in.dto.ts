import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CheckInDto {
  @ApiPropertyOptional({
    example: 'a3f5c9e0-...-employee-id',
    description:
      'Employee this scan is recorded for. Normally resolved server-side from the ' +
      'authenticated caller and ignored when present; an ADMIN-scoped caller may set ' +
      'this to record a scan on behalf of another employee.',
  })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({
    example: 0.92,
    description:
      'Face-match confidence score (0..1) reported by the on-device model. Optional ' +
      'when `embedding` is provided: the server then computes an authoritative score ' +
      'itself and ignores this value. Kept for backward compatibility with clients ' +
      'that only send a pre-computed score.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  faceScore?: number;

  @ApiPropertyOptional({
    type: [Number],
    description:
      'Live face-recognition embedding captured at scan time. When present, the ' +
      "server matches it server-side against the employee's enrolled FaceTemplates " +
      'and uses that result as the authoritative faceScore.',
    example: [0.0123, -0.0456, 0.0789],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  embedding?: number[];

  @ApiProperty({ example: 41.311081 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 69.240562 })
  @IsLongitude()
  longitude!: number;
}
