import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

/** Query for "which mahalla is this point in?" lookups. */
export class LocateQueryDto {
  @ApiProperty({ example: 41.3111, description: 'Latitude (WGS84)' })
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty({ example: 69.3402, description: 'Longitude (WGS84)' })
  @Type(() => Number)
  @IsLongitude()
  lng!: number;
}
