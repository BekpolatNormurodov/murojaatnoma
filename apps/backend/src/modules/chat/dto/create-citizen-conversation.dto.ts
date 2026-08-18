import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Body for `POST /chat/conversations/citizen` — opens (or re-opens) a 1:1
 * conversation with an app-user (fuqaro). Mirrors the employee DM, but keyed by
 * the app-user id (`dm-citizen-<appUserId>`). Decoupled from the app-users
 * table: the caller (web-admin AppUserDetail) already has the display name/color.
 */
export class CreateCitizenConversationDto {
  @ApiProperty({
    description:
      "Fuqaro (app-user) id'si — DM suhbatini shu bilan bog'laydi (`dm-citizen-<appUserId>`)",
  })
  @IsString()
  @MinLength(1)
  appUserId!: string;

  @ApiProperty({ description: "Suhbat sarlavhasi (fuqaroning ko'rsatiladigan ismi)" })
  @IsString()
  @MinLength(1)
  title!: string;

  @ApiPropertyOptional({ description: 'Avatar rangi (hex), masalan "#10b981"' })
  @IsOptional()
  @IsString()
  avatarColor?: string;
}
