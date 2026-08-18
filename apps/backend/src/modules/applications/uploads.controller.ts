import {
  BadRequestException,
  Body,
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppConfig } from '../../common/config/configuration';

/** Shape returned to a client after a successful upload. */
export interface UploadedMediaResult {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  durationSec?: number;
}

/**
 * Generic media upload endpoint shared by the realtime chat clients
 * (web-admin + worker-app). A client uploads the raw voice/image/file here
 * FIRST, receives a durable public URL, then references that URL in the
 * realtime `chat:send` event — the socket gateway never handles blobs. This
 * is what turns a recorded `blob:`/`m4a` (which is dead cross-client) into a
 * URL every device can load.
 *
 * Distinct from POST /applications/:id/attachments/upload, which additionally
 * persists an Attachment row tied to a specific application. This one is
 * stateless: file in, URL out.
 *
 * Reuses the MulterModule storage configured in applications.module.ts
 * (diskStorage → UPLOADS_DIR, 25MB cap, image/video/audio mimetypes only).
 * Requires a valid staff token (no @Public) — chat is admin↔employee only,
 * so citizens are denied by the global CitizenAccessGuard.
 */
@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  @ApiBearerAuth()
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        // Optional: for voice/video the client already knows the recorded
        // length and passes it through so it can be echoed straight into the
        // chat message without the server having to probe the media.
        durationSec: { type: 'number' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Upload a media file (multipart, field "file", ≤25MB, image/video/audio) and get a durable public URL. ' +
      'Chat attachment flow: upload here → then emit chat:send with the returned url + kind.',
  })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('durationSec') durationSec?: string,
  ): UploadedMediaResult {
    if (!file) {
      throw new BadRequestException('file is required');
    }

    const { publicBaseUrl } = this.configService.get('uploads', { infer: true });
    const parsedDuration = durationSec !== undefined ? Number(durationSec) : undefined;

    return {
      url: `${publicBaseUrl}/uploads/${file.filename}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      ...(parsedDuration !== undefined && Number.isFinite(parsedDuration)
        ? { durationSec: parsedDuration }
        : {}),
    };
  }

  @ApiBearerAuth()
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Upload an IMAGE (multipart, field "file", ≤5MB, jpeg/png/webp only) → { url }. ' +
      'Used for avatars/photos (e.g. the web-admin worker form). Server-side ' +
      'validates the type + size, unlike the generic POST /uploads.',
  })
  uploadImage(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): { url: string } {
    const { publicBaseUrl } = this.configService.get('uploads', { infer: true });
    return { url: `${publicBaseUrl}/uploads/${file.filename}` };
  }
}
