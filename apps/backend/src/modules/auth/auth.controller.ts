import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { TokenPairDto } from './dto/token-pair.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a one-time SMS code to the given phone number' })
  requestOtp(@Body() dto: RequestOtpDto): Promise<{ expiresInSeconds: number }> {
    return this.authService.requestOtp(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the OTP code and obtain a token pair' })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<TokenPairDto> {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPairDto> {
    return this.authService.refresh(dto.refreshToken);
  }
}
