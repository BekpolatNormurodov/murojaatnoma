import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { RequireScope } from '../../common/decorators/scope.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminRefreshDto } from './dto/admin-refresh.dto';

/**
 * Web-admin authentication endpoints, mounted under /auth/admin so they never
 * collide with the mobile employee OTP routes under /auth.
 */
@ApiTags('admin-auth')
@Controller('auth/admin')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Web-admin login (username + password)' })
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate the admin refresh token' })
  refresh(@Body() dto: AdminRefreshDto) {
    return this.adminAuthService.refresh(dto.refreshToken);
  }

  @RequireScope('admin')
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Current admin profile' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.adminAuthService.me(user.employeeId);
  }
}
