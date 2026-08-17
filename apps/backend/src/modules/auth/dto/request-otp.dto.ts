import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { E164_PHONE_REGEX } from '../../../common/constants/validation.constants';

export class RequestOtpDto {
  @ApiProperty({ example: '+998901234567', description: 'E.164 phone number' })
  @Matches(E164_PHONE_REGEX, {
    message: 'phone must be a valid E.164 phone number, e.g. +998901234567',
  })
  phone!: string;
}
