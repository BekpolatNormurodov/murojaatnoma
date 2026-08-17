import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import {
  E164_PHONE_REGEX,
  OTP_CODE_REGEX,
} from '../../../common/constants/validation.constants';

export class VerifyOtpDto {
  @ApiProperty({ example: '+998901234567' })
  @Matches(E164_PHONE_REGEX, {
    message: 'phone must be a valid E.164 phone number, e.g. +998901234567',
  })
  phone!: string;

  @ApiProperty({ example: '123456', description: '4-6 digit OTP code' })
  @Matches(OTP_CODE_REGEX, { message: 'code must be a 4-6 digit number' })
  code!: string;
}
