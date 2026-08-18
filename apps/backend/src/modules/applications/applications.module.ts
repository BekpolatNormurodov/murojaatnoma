import { BadRequestException, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AppConfig } from '../../common/config/configuration';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';

/** Max size accepted for a single application attachment upload (photo/video/voice). */
const MAX_ATTACHMENT_UPLOAD_BYTES = 25 * 1024 * 1024;

/** multipart/form-data file uploads are only accepted for these media kinds. */
const ALLOWED_ATTACHMENT_MIME_PREFIXES = ['image/', 'video/', 'audio/'];

@Module({
  imports: [
    // Backs POST /applications/:id/attachments/upload (see
    // applications.controller.ts). Configured via MulterModule.registerAsync
    // (rather than inline FileInterceptor options) so the destination
    // directory can be sourced from ConfigService/UPLOADS_DIR instead of
    // reading process.env directly in the controller.
    MulterModule.registerAsync({
      useFactory: (configService: ConfigService<AppConfig, true>) => {
        const { dir } = configService.get('uploads', { infer: true });
        // Ensure the upload directory exists before the first request hits
        // diskStorage's destination callback.
        fs.mkdirSync(dir, { recursive: true });

        return {
          storage: diskStorage({
            destination: dir,
            filename: (_req, file, callback) => {
              // Collision-free, non-guessable filename; original name is
              // preserved separately on the Attachment row (fileName).
              callback(null, `${randomUUID()}${extname(file.originalname)}`);
            },
          }),
          limits: { fileSize: MAX_ATTACHMENT_UPLOAD_BYTES },
          fileFilter: (_req, file, callback) => {
            const isAllowed = ALLOWED_ATTACHMENT_MIME_PREFIXES.some((prefix) =>
              file.mimetype.startsWith(prefix),
            );
            if (!isAllowed) {
              callback(
                new BadRequestException(
                  `Unsupported file type: ${file.mimetype}. Only image/video/audio uploads are accepted.`,
                ),
                false,
              );
              return;
            }
            callback(null, true);
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
