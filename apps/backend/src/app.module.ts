import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './common/config/configuration';
import { envValidationSchema } from './common/config/env.validation';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PrismaModule } from './common/prisma/prisma.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    EmployeesModule,
    AttendanceModule,
    ApplicationsModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
