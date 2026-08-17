import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppUserStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

/**
 * Body for `PATCH /app-users/:id` — admin moderation actions: block/unblock
 * (via `status`), verify a citizen's identity, or toggle push notifications
 * on their behalf. Mirrors the "Bloklash / Blokdan chiqarish" action in the
 * web-admin `AppUserDetail` drawer.
 */
export class UpdateAppUserDto {
  @ApiPropertyOptional({ enum: AppUserStatus })
  @IsOptional()
  @IsEnum(AppUserStatus)
  status?: AppUserStatus;

  @ApiPropertyOptional({ description: "Shaxsi tasdiqlangan (ID) flagini o'rnatish" })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional({ description: 'Push bildirishnomalarni yoqish/o\'chirish' })
  @IsOptional()
  @IsBoolean()
  notificationsOn?: boolean;
}
