import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { MAX_IMAGE_SIDE, optimizeImageUpload } from './image-optimizer';

describe('optimizeImageUpload', () => {
  const dir = mkdtempSync(join(tmpdir(), 'imgopt-'));

  it('scales a phone-size photo down and writes a WebP twin', async () => {
    const p = join(dir, 'big.jpg');
    writeFileSync(
      p,
      await sharp({ create: { width: 4000, height: 3000, channels: 3, background: '#7a9' } }).jpeg({ quality: 95 }).toBuffer(),
    );
    const size = await optimizeImageUpload(p, 'image/jpeg');
    const meta = await sharp(p).metadata();
    expect(Math.max(meta.width!, meta.height!)).toBe(MAX_IMAGE_SIDE);
    expect(size).toBe(readFileSync(p).length);
    expect(existsSync(`${p}.webp`)).toBe(true);
    expect((await sharp(`${p}.webp`).metadata()).format).toBe('webp');
  });

  it('leaves non-images and broken files alone', async () => {
    const v = join(dir, 'clip.webm');
    writeFileSync(v, 'not a picture');
    expect(await optimizeImageUpload(v, 'video/webm')).toBeNull();
    const broken = join(dir, 'fake.jpg');
    writeFileSync(broken, 'realphoto-bytes-1234');
    expect(await optimizeImageUpload(broken, 'image/jpeg')).toBeNull();
    expect(readFileSync(broken, 'utf8')).toBe('realphoto-bytes-1234');
  });
});
