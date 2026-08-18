import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

/** Query for GET /chat/conversations — filter by archive state. */
export class ListConversationsQueryDto {
  @ApiPropertyOptional({
    description:
      'Archive filter. Omit ⇒ only non-archived (main list). true ⇒ Archive view.',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  archived?: boolean;
}
