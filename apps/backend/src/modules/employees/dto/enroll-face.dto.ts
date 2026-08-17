import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNumber } from 'class-validator';

export class EnrollFaceDto {
  @ApiProperty({
    type: [Number],
    description: 'Face-recognition embedding vector produced by the mobile client',
    example: [0.0123, -0.0456, 0.0789],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  embedding!: number[];
}
