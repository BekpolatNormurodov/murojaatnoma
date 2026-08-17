import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateLocationDto } from './create-location.dto';

/**
 * A batch of buffered GPS reports flushed by the mobile offline queue when
 * connectivity returns. Applied oldest-first; the newest becomes "latest".
 */
export class CreateLocationBatchDto {
  @ApiProperty({ type: [CreateLocationDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateLocationDto)
  items!: CreateLocationDto[];
}
