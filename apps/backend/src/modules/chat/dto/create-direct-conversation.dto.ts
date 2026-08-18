import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Body for `POST /chat/conversations/direct` — opens (or re-opens) a 1:1
 * conversation with an employee. Intentionally decoupled from the
 * employee/workforce table: the caller (web-admin, resolving from the same
 * live employee list the map uses) already has the display name/color, so
 * this module never needs to query workforce data itself.
 */
export class CreateDirectConversationDto {
  @ApiProperty({
    description: "Xodim id'si — DM suhbatini shu bilan bog'laydi (`dm-emp-<employeeId>`)",
  })
  @IsString()
  @MinLength(1)
  employeeId!: string;

  @ApiProperty({ description: "Suhbat sarlavhasi (xodimning ko'rsatiladigan ismi)" })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ description: 'Avatar rangi (hex), masalan "#10b981"' })
  @IsOptional()
  @IsString()
  avatarColor?: string;
}
