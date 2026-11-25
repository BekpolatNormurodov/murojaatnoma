import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { LocationsController } from '../../modules/locations/locations.controller';
import { LocationsService } from '../../modules/locations/locations.service';
import { useJsonBodyLimit } from './body-limit';

/** A full offline flush, shaped like the worker-app's items. */
const items = Array.from({ length: 500 }, (_, i) => ({
  latitude: 41.311081234567 + i * 1e-6,
  longitude: 69.240562123456 + i * 1e-6,
  accuracy: 12.34567890123456,
  speed: 1.234567890123456,
  heading: 182.3456789012345,
  battery: 87,
  source: 'BACKGROUND',
  // Dart prints microseconds.
  recordedAt: new Date(Date.UTC(2026, 10, 24, 4, 0, i))
    .toISOString()
    .replace('Z', '123Z'),
}));

describe('POST /locations/batch — 500 ta nuqta', () => {
  let app: NestExpressApplication;
  const ingestBatch = jest.fn().mockResolvedValue({ accepted: 500, latest: null });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [{ provide: LocationsService, useValue: { ingestBatch } }],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    useJsonBodyLimit(app);
    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.assign(req, { user: { employeeId: 'e1' } });
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
  });

  afterAll(() => app.close());

  it('100 KB dan katta tana qabul qilinadi', async () => {
    expect(JSON.stringify({ items }).length).toBeGreaterThan(100 * 1024);
    const res = await request(app.getHttpServer())
      .post('/locations/batch')
      .send({ items })
      .expect(201);
    expect(res.body).toEqual({ accepted: 500, latest: null });
    expect(ingestBatch.mock.calls[0][1]).toHaveLength(500);
  });

  it('501 ta nuqta rad etiladi', async () => {
    await request(app.getHttpServer())
      .post('/locations/batch')
      .send({ items: [...items, items[0]] })
      .expect(400);
  });
});
