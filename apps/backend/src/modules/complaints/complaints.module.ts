import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AppConfig } from '../../common/config/configuration';
import { uploadMulterOptions } from '../../common/upload/upload-policy';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';

@Module({
  imports: [
    // Backs POST /complaints/:id/messages (see complaints.controller.ts). The
    // same disk storage, 25MB cap and type whitelist as the applications
    // uploads (common/upload/upload-policy.ts) — media only here.
    MulterModule.registerAsync({
      useFactory: (configService: ConfigService<AppConfig, true>) =>
        uploadMulterOptions(configService.get('uploads', { infer: true }).dir),
      inject: [ConfigService],
    }),
  ],
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
