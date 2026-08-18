import { ApiProperty } from '@nestjs/swagger';
import { DevicePlatform } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @ApiProperty({ description: 'FCM registration token reported by the device' })
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  token!: string;

  @ApiProperty({
    enum: DevicePlatform,
    required: false,
    default: DevicePlatform.ANDROID,
    description: 'Device platform (defaults to ANDROID when omitted)',
  })
  @IsOptional()
  @IsEnum(DevicePlatform)
  platform: DevicePlatform = DevicePlatform.ANDROID;
}
