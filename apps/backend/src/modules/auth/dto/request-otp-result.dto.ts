import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestOtpResultDto {
  @ApiProperty({ description: 'Seconds until the generated OTP code expires' })
  expiresInSeconds!: number;

  @ApiPropertyOptional({
    description:
      'The generated OTP code, included only when OTP_DEV_ECHO=true. Development ' +
      'convenience so the login flow can be exercised without a real SMS gateway; ' +
      'a production provider (e.g. Eskiz.uz) replaces the stub sender and this ' +
      'field is omitted.',
    example: '123456',
  })
  devCode?: string;
}
