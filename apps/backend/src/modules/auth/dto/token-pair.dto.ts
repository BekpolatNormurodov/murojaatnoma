import { ApiProperty } from '@nestjs/swagger';

export class TokenPairDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ description: 'Access token lifetime in seconds' })
  expiresIn!: number;
}
