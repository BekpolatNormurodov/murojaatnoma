import { BadRequestException, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AppConfig } from '../../common/config/configuration';
import { ComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';

/** Max size accepted for a single complaint message attachment upload (photo/video/voice). */
const MAX_ATTACHMENT_UPLOAD_BYTES = 25 * 1024 * 1024;

/** multipart/form-data file uploads are only accepted for these media kinds. */
const ALLOWED_ATTACHMENT_MIME_PREFIXES = ['image/', 'video/', 'audio/'];

@Module({
  imports: [
    // Backs POST /complaints/:id/messages (see complaints.controller.ts). Same
    // disk-storage config as the applications upload so both share the
    // UPLOADS_DIR destination, 25MB cap and image/video/audio-only filter.
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
              // preserved separately on the ComplaintAttachment row (fileName).
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
  controllers: [ComplaintsController],
  providers: [ComplaintsService],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
