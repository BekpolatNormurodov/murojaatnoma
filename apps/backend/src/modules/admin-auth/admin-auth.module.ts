import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

/**
 * Web-admin auth (username/password). Registers its own empty JwtModule —
 * like the employee AuthModule, tokens are signed per-call with explicit
 * secrets/TTLs, so no global secret is configured here.
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminAuthController],
  providers: [AdminAuthService],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
