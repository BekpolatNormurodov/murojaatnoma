import { Module } from '@nestjs/common';
import { AppUsersController } from './app-users.controller';
import { AppUsersService } from './app-users.service';

/**
 * Mobil ilova foydalanuvchilari (App Users) admin module: read-only listing,
 * detail, and dashboard aggregates (stats/DAU/growth) backed by the
 * `AppUser` Prisma model seeded from web-admin's mock data.
 */
@Module({
  controllers: [AppUsersController],
  providers: [AppUsersService],
  exports: [AppUsersService],
})
export class AppUsersModule {}
