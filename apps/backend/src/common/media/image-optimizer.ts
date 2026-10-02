import { Logger } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';

const logger = new Logger('ImageOptimizer');

/** Formats we re-encode; GIF/SVG/HEIC and everything else is left untouched. */
const OPTIMIZABLE = /^image\/(jpe?g|png|webp)$/i;

/** Longest side kept for a stored photo (a phone shot is ~4000 px / 3–5 MB). */
export const MAX_IMAGE_SIDE = 1600;

/**
 * Makes an uploaded photo cheap to show without changing its URL:
 * - oversized photos are scaled down (≤ 1600 px, EXIF rotation applied) and
 *   re-encoded in place in their own format;
 * - a `<file>.webp` sibling is written — the gateway serves it instead of the
 *   original to browsers that accept WebP (`Vary: Accept`).
 * Best effort: any failure leaves the original upload exactly as it was.
 *
 * @returns the stored file's size in bytes after optimisation (null = untouched)
 */
export async function optimizeImageUpload(path: string, mimetype: string): Promise<number | null> {
  if (!OPTIMIZABLE.test(mimetype)) return null;
  try {
    const input = await fs.readFile(path);
    const meta = await sharp(input, { failOn: 'none' }).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;
    const oversized = Math.max(width, height) > MAX_IMAGE_SIDE;
    const heavy = input.length > 600 * 1024;

    const base = () =>
      sharp(input, { failOn: 'none' })
        .rotate()
        .resize({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE, fit: 'inside', withoutEnlargement: true });

    let size = input.length;
    if (oversized || heavy) {
      const fmt = meta.format;
      const out =
        fmt === 'png'
          ? await base().png({ compressionLevel: 9, effort: 7 }).toBuffer()
          : fmt === 'webp'
            ? await base().webp({ quality: 80 }).toBuffer()
            : await base().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      // Only keep the re-encode when it actually helps.
      if (out.length < input.length) {
        await fs.writeFile(path, out);
        size = out.length;
      }
    }
    if (meta.format !== 'webp') {
      await fs.writeFile(`${path}.webp`, await base().webp({ quality: 78 }).toBuffer());
    }
    return size;
  } catch (e) {
    logger.warn(`could not optimise ${path}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}
