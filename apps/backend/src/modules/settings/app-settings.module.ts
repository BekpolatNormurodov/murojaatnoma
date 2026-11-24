import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AppSettingsController } from './app-settings.controller';
import { AppSettingsService } from './app-settings.service';

/** Global: attendance (and anything else rule-driven) reads the switches. */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AppSettingsController],
  providers: [AppSettingsService],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
