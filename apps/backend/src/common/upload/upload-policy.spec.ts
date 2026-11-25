import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import request from 'supertest';
import { UploadsController } from '../../modules/applications/uploads.controller';
import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { MAX_UPLOAD_BYTES, uploadMulterOptions } from './upload-policy';

describe('fayl yuklash (HTTP)', () => {
  let app: INestApplication;
  let dir: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'upload-policy-'));
    const moduleRef = await Test.createTestingModule({
      imports: [MulterModule.register(uploadMulterOptions(dir))],
      controllers: [UploadsController],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: () => ({ publicBaseUrl: 'https://example.test' }) },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    // One listening server: per-request ephemeral ones can reuse a closed socket.
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const send = (
    url: string,
    filename: string,
    contentType: string,
    body = Buffer.from('x'),
  ) =>
    request(app.getHttpServer())
      .post(url)
      .attach('file', body, { filename, contentType });

  it('saqlangan nom — tasodifiy, kengaytma kichik harfda va ro‘yxatdan', async () => {
    const res = await send('/uploads/document', 'Hisobot.PDF', 'application/pdf').expect(
      201,
    );
    expect(res.body.url).toMatch(
      /^https:\/\/example\.test\/uploads\/[0-9a-f-]{36}\.pdf$/,
    );
    expect(fs.existsSync(path.join(dir, res.body.url.split('/').pop()))).toBe(true);
    const voice = await send('/uploads', 'ovoz', 'audio/mp4').expect(201);
    expect(voice.body.url).toMatch(/\.m4a$/);
  });

  it('boshqa tur — 400, o‘zbekcha xabar, diskka yozilmaydi', async () => {
    const before = fs.readdirSync(dir).length;
    for (const [url, name, type] of [
      ['/uploads', 'x.html', 'image/png'],
      ['/uploads', 'x.svg', 'image/svg+xml'],
      ['/uploads/document', 'x.xml', 'text/xml'],
      ['/uploads', 'x.pdf', 'application/pdf'],
    ]) {
      const res = await send(url, name, type).expect(400);
      expect(res.body.message).toBe('Bu turdagi fayl qabul qilinmaydi');
    }
    expect(fs.readdirSync(dir)).toHaveLength(before);
  });

  it('/uploads/image — rasm qabul qilinadi, video va 5 MB dan kattasi — 400', async () => {
    const ok = await send('/uploads/image', 'a.png', 'image/png').expect(201);
    expect(ok.body.url).toMatch(/\.png$/);
    await send('/uploads/image', 'a.mp4', 'video/mp4').expect(400);
    await send(
      '/uploads/image',
      'big.jpg',
      'image/jpeg',
      Buffer.alloc(5 * 1024 * 1024 + 1),
    ).expect(400);
  });

  it('25 MB mumkin, undan katta — 413, o‘zbekcha xabar', async () => {
    await send('/uploads', 'a.mp4', 'video/mp4', Buffer.alloc(MAX_UPLOAD_BYTES)).expect(
      201,
    );
    const res = await send(
      '/uploads',
      'b.mp4',
      'video/mp4',
      Buffer.alloc(MAX_UPLOAD_BYTES + 1),
    ).expect(413);
    expect(res.body.message).toBe('Fayl hajmi 25 MB dan oshmasligi kerak');
  });
});
