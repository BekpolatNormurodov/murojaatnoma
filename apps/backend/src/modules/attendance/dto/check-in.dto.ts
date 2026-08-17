import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNumber, IsString, Max, Min } from 'class-validator';

export class CheckInDto {
  @ApiProperty({ example: 'a3f5c9e0-...-employee-id' })
  @IsString()
  employeeId!: string;

  @ApiProperty({
    example: 0.92,
    description: 'Face-match confidence score returned by the on-device model (0..1)',
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  faceScore!: number;

  @ApiProperty({ example: 41.311081 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 69.240562 })
  @IsLongitude()
  longitude!: number;
}
