import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpSmsProvider } from './providers/otp-sms.provider';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Registered without a global secret: AuthService signs access/refresh
    // tokens explicitly with their own secrets and TTLs per call.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, OtpSmsProvider],
  exports: [AuthService],
})
export class AuthModule {}
