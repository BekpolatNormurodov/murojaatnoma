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
  // Read the RAW query value via `obj`, not `value`: the global ValidationPipe
  // runs with `enableImplicitConversion: true`, which coerces the query string
  // to Boolean first — and `Boolean('false') === true`, so a `value`-based
  // transform receives `true` for BOTH `archived=true` and `archived=false`.
  // `obj.archived` is the untouched string, so `'false'` stays false.
  @IsOptional()
  @Transform(({ obj, value }) => {
    const raw = obj?.archived ?? value;
    return raw === true || raw === 'true' || raw === 1 || raw === '1';
  })
  @IsBoolean()
  archived?: boolean;
}
