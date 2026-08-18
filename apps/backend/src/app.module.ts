import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './common/config/configuration';
import { envValidationSchema } from './common/config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { CitizenAccessGuard } from './common/guards/citizen-access.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ScopeGuard } from './common/guards/scope.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PrismaModule } from './common/prisma/prisma.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AppUsersModule } from './modules/app-users/app-users.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuthModule } from './modules/auth/auth.module';
import { BonusesModule } from './modules/bonuses/bonuses.module';
import { BootstrapModule } from './modules/bootstrap/bootstrap.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ChatModule } from './modules/chat/chat.module';
import { ComplaintsModule } from './modules/complaints/complaints.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HealthModule } from './modules/health/health.module';
import { LeaveModule } from './modules/leave/leave.module';
import { LocationsModule } from './modules/locations/locations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PointsModule } from './modules/points/points.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SuggestionsModule } from './modules/suggestions/suggestions.module';
import { WorkforceModule } from './modules/workforce/workforce.module';
import { ZonesModule } from './modules/zones/zones.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    EmployeesModule,
    AttendanceModule,
    ApplicationsModule,
    NotificationsModule,
    ZonesModule,
    LocationsModule,
    AdminAuthModule,
    BootstrapModule,
    // Admin data domain (web-admin) — @Public read/stats endpoints
    RequestsModule,
    WorkforceModule,
    ComplaintsModule,
    AppUsersModule,
    AnalyticsModule,
    CatalogModule,
    FinanceModule,
    ChatModule,
    // Worker-app employee features (points/rating + suggestions)
    PointsModule,
    SuggestionsModule,
    LeaveModule,
    BonusesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Runs after JwtAuthGuard: denies CITIZEN-scope tokens every route not
    // marked @AllowCitizen() (secure-by-default). Inert until citizen tokens
    // are re-enabled in AuthService.verifyOtp.
    { provide: APP_GUARD, useClass: CitizenAccessGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ScopeGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
