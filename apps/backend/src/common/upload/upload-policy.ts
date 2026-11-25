import { BadRequestException } from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import { extname } from 'path';

/**
 * One upload rule for every multer endpoint. Stored files are served by the
 * gateway on the web-admin's own origin, so the EXTENSION on disk (which picks
 * the Content-Type) must come from this whitelist — never from whatever name or
 * mimetype the client sent. Otherwise `x.html` declared as `image/png` would
 * run as a page next to the admin's tokens.
 */

/** Max size of one uploaded file. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const UPLOAD_TYPE_MESSAGE = 'Bu turdagi fayl qabul qilinmaydi';
export const UPLOAD_SIZE_MESSAGE = 'Fayl hajmi 25 MB dan oshmasligi kerak';

/** Keep in step with the media list in infra's nginx `$upload_disposition` map. */
export const MEDIA_EXTENSIONS: ReadonlySet<string> = new Set(
  (
    'jpg jpeg png webp gif heic heif bmp ' +
    'mp4 mov m4v webm 3gp mkv avi ' +
    'm4a aac mp3 ogg oga opus wav amr caf flac'
  ).split(' '),
);

/** Office documents — accepted ONLY on POST /uploads/document (kunlik hisobot hujjatlari). */
export const DOCUMENT_EXTENSIONS: ReadonlySet<string> = new Set(
  'pdf doc docx xls xlsx ppt pptx txt csv rtf odt ods zip'.split(' '),
);

/** Used only when the file name carries no extension at all. */
const EXTENSION_BY_MIME = new Map<string, string>(
  Object.entries({
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/pjpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/bmp': 'bmp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/x-m4v': 'm4v',
    'video/webm': 'webm',
    'video/3gpp': '3gp',
    'video/x-matroska': 'mkv',
    'video/x-msvideo': 'avi',
    'audio/mp4': 'm4a',
    'audio/m4a': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/aac': 'aac',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/opus': 'opus',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/amr': 'amr',
    'audio/x-caf': 'caf',
    'audio/flac': 'flac',
    'audio/x-flac': 'flac',
    'audio/webm': 'webm',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/rtf': 'rtf',
    'application/vnd.oasis.opendocument.text': 'odt',
    'application/vnd.oasis.opendocument.spreadsheet': 'ods',
    'application/zip': 'zip',
  }),
);

const MEDIA_MIME_PREFIXES = ['image/', 'video/', 'audio/'];
const DOCUMENT_UPLOAD_PATH = /\/uploads\/document\/?$/;

/**
 * The lowercase extension (no dot) this upload is stored under, or null when it
 * must be refused. Media is accepted everywhere (declared as image/video/audio);
 * documents only on /uploads/document, judged by extension because phones often
 * send a generic `application/octet-stream` for a file picked from Files.
 */
export function storedExtension(
  originalUrl: string,
  mimetype: string,
  originalName: string,
): string | null {
  // The path only: "…?x=/uploads/document" must not unlock documents.
  const documents = DOCUMENT_UPLOAD_PATH.test(originalUrl.split('?')[0]);
  const type = mimetype.toLowerCase();
  const ext =
    extname(originalName).slice(1).toLowerCase() || (EXTENSION_BY_MIME.get(type) ?? '');

  if (MEDIA_EXTENSIONS.has(ext)) {
    return documents || MEDIA_MIME_PREFIXES.some((p) => type.startsWith(p)) ? ext : null;
  }
  return documents && DOCUMENT_EXTENSIONS.has(ext) ? ext : null;
}

export function isAllowedUpload(
  originalUrl: string,
  mimetype: string,
  originalName: string,
): boolean {
  return storedExtension(originalUrl, mimetype, originalName) !== null;
}

const urlOf = (req: unknown): string =>
  (req as { originalUrl?: string }).originalUrl ?? '';

/** The MulterModule configuration shared by every module that accepts files. */
export function uploadMulterOptions(dir: string): MulterOptions {
  // Ensure the upload directory exists before the first request hits
  // diskStorage's destination callback.
  fs.mkdirSync(dir, { recursive: true });
  return {
    storage: diskStorage({
      destination: dir,
      filename: (req, file, callback) => {
        const ext = storedExtension(urlOf(req), file.mimetype, file.originalname);
        if (!ext) {
          callback(new BadRequestException(UPLOAD_TYPE_MESSAGE), '');
          return;
        }
        // Collision-free, non-guessable name; the original name is preserved
        // separately by the caller (fileName).
        callback(null, `${randomUUID()}.${ext}`);
      },
    }),
    // busboy refuses a file that REACHES the limit: one byte more lets exactly 25 MB in.
    limits: { fileSize: MAX_UPLOAD_BYTES + 1 },
    fileFilter: (req, file, callback) => {
      if (!isAllowedUpload(urlOf(req), file.mimetype, file.originalname)) {
        callback(new BadRequestException(UPLOAD_TYPE_MESSAGE), false);
        return;
      }
      callback(null, true);
    },
  };
}
