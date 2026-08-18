import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

/**
 * Web-admin auth (username/password). Registers its own empty JwtModule —
 * like the employee AuthModule, tokens are signed per-call with explicit
 * secrets/TTLs, so no global secret is configured here.
 */
@Module({
  imports: [JwtModule.register({})],
  controllers: [AdminAuthController, AdminUsersController],
  providers: [AdminAuthService, AdminUsersService],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}
