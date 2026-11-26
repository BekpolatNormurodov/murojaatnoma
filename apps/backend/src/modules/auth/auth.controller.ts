import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AuthService } from './auth.service';
import { clientInfo } from './client-info';
import { EmployeeLoginDto } from './dto/employee-login.dto';
import { MeDto } from './dto/me.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { RequestOtpResultDto } from './dto/request-otp-result.dto';
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
  requestOtp(@Body() dto: RequestOtpDto): Promise<RequestOtpResultDto> {
    return this.authService.requestOtp(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the OTP code and obtain a citizen token pair' })
  verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Headers() headers: Record<string, unknown>,
  ): Promise<TokenPairDto> {
    return this.authService.verifyOtp(dto, clientInfo(headers));
  }

  @Public()
  @Post('employee/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Employee login with username + password (worker-app)' })
  employeeLogin(
    @Body() dto: EmployeeLoginDto,
    @Headers() headers: Record<string, unknown>,
  ): Promise<TokenPairDto> {
    return this.authService.employeeLogin(dto, clientInfo(headers));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new token pair' })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Headers() headers: Record<string, unknown>,
  ): Promise<TokenPairDto> {
    return this.authService.refresh(dto.refreshToken, clientInfo(headers));
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a refresh token (worker-app / user-app logout)' })
  logout(@Body() dto: RefreshTokenDto): Promise<{ ok: true }> {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated employee profile' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<MeDto> {
    return this.authService.me(user.employeeId);
  }
}
