import * as Joi from 'joi';
import {
  DEFAULT_FACE_MATCH_THRESHOLD,
  DEFAULT_GEOFENCE_RADIUS_M,
  DEFAULT_OFFICE_LATITUDE,
  DEFAULT_OFFICE_LONGITUDE,
  DEFAULT_OTP_TTL_SECONDS,
  DEFAULT_PUBLIC_BASE_URL,
  DEFAULT_STALE_LOCATION_MINUTES,
  DEFAULT_UPLOADS_DIR,
  DEFAULT_WORK_START,
  DEFAULT_WORK_END,
  LATE_GRACE_MINUTES,
} from './constants';

/**
 * Joi schema for process.env. Fails fast on startup if required variables
 * are missing or malformed, instead of failing later at first use.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  JWT_REFRESH_TTL: Joi.string().default('30d'),

  OTP_TTL_SECONDS: Joi.number().integer().positive().default(DEFAULT_OTP_TTL_SECONDS),
  // Dev convenience only: when true, /auth/request-otp echoes the generated
  // code back in the response so the login flow can be exercised without a
  // live SMS gateway. Must stay false in production.
  OTP_DEV_ECHO: Joi.boolean().truthy('true').falsy('false').default(false),

  FACE_MATCH_THRESHOLD: Joi.number().min(0).max(1).default(DEFAULT_FACE_MATCH_THRESHOLD),
  GEOFENCE_RADIUS_M: Joi.number().positive().default(DEFAULT_GEOFENCE_RADIUS_M),
  OFFICE_LATITUDE: Joi.number().min(-90).max(90).default(DEFAULT_OFFICE_LATITUDE),
  OFFICE_LONGITUDE: Joi.number().min(-180).max(180).default(DEFAULT_OFFICE_LONGITUDE),

  STALE_LOCATION_MINUTES: Joi.number()
    .integer()
    .positive()
    .default(DEFAULT_STALE_LOCATION_MINUTES),

  WORK_START_TIME: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .default(DEFAULT_WORK_START),
  WORK_END_TIME: Joi.string()
    .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .default(DEFAULT_WORK_END),
  LATE_GRACE_MINUTES: Joi.number().integer().min(0).default(LATE_GRACE_MINUTES),

  // Admin panel seed credentials (web-admin real login). If ADMIN_PASSWORD is
  // empty, the bootstrap seeder generates a random one and logs it once.
  ADMIN_USERNAME: Joi.string().default('admin'),
  ADMIN_PASSWORD: Joi.string().allow('').default(''),
  ADMIN_FULL_NAME: Joi.string().default('Bosh administrator'),
  SEED_DEMO_DATA: Joi.boolean().truthy('true').falsy('false').default(true),

  // Attachment uploads (photo/video/voice) for applications — see
  // modules/applications/applications.module.ts (MulterModule.registerAsync)
  // and POST /applications/:id/attachments/upload.
  UPLOADS_DIR: Joi.string().default(DEFAULT_UPLOADS_DIR),
  PUBLIC_BASE_URL: Joi.string().default(DEFAULT_PUBLIC_BASE_URL),

  // Firebase Cloud Messaging (push). Both optional: when the service-account
  // b64 is empty, push is disabled and the app logs payloads instead. The
  // secret lives only in the server's gitignored .env (repo is public).
  FIREBASE_PROJECT_ID: Joi.string().allow('').default(''),
  FIREBASE_SERVICE_ACCOUNT_B64: Joi.string().allow('').default(''),
});
