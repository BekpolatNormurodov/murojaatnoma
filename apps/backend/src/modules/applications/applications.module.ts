import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AppConfig } from '../../common/config/configuration';
import { uploadMulterOptions } from '../../common/upload/upload-policy';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { UploadsController } from './uploads.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    // Backs POST /applications/:id/attachments/upload (see
    // applications.controller.ts) and /uploads/*. Configured via
    // MulterModule.registerAsync (rather than inline FileInterceptor options) so
    // the destination directory can be sourced from ConfigService/UPLOADS_DIR
    // instead of reading process.env directly in the controller. Size cap and
    // accepted types: common/upload/upload-policy.ts.
    MulterModule.registerAsync({
      useFactory: (configService: ConfigService<AppConfig, true>) =>
        uploadMulterOptions(configService.get('uploads', { infer: true }).dir),
      inject: [ConfigService],
    }),
  ],
  controllers: [ApplicationsController, UploadsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
