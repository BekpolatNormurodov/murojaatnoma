import * as Joi from 'joi';
import {
  DEFAULT_FACE_MATCH_THRESHOLD,
  DEFAULT_GEOFENCE_RADIUS_M,
  DEFAULT_OTP_TTL_SECONDS,
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

  FACE_MATCH_THRESHOLD: Joi.number().min(0).max(1).default(DEFAULT_FACE_MATCH_THRESHOLD),
  GEOFENCE_RADIUS_M: Joi.number().positive().default(DEFAULT_GEOFENCE_RADIUS_M),
  OFFICE_LATITUDE: Joi.number().min(-90).max(90).default(41.311081),
  OFFICE_LONGITUDE: Joi.number().min(-180).max(180).default(69.240562),
});
