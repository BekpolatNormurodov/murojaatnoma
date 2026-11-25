import { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Express's default JSON limit is 100 kb — less than a full offline location
 * flush (POST /locations/batch, 500 items; installed app builds send the whole
 * buffer in one request).
 */
export const JSON_BODY_LIMIT = '1mb';

/** Must run before the app is initialised, so it replaces the default JSON parser. */
export function useJsonBodyLimit(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
}
