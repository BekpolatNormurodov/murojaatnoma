import {
  DEFAULT_FACE_MATCH_THRESHOLD,
  DEFAULT_GEOFENCE_RADIUS_M,
  DEFAULT_OTP_TTL_SECONDS,
} from './constants';

/**
 * Typed, namespaced application configuration built from process.env.
 * Consumed via `ConfigService.get<AppConfig>('...')`.
 */
export interface AppConfig {
  app: {
    nodeEnv: string;
    port: number;
  };
  database: {
    url: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  otp: {
    ttlSeconds: number;
  };
  attendance: {
    faceMatchThreshold: number;
    geofenceRadiusM: number;
    officeLatitude: number;
    officeLongitude: number;
  };
}

export default (): AppConfig => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? `${DEFAULT_OTP_TTL_SECONDS}`, 10),
  },
  attendance: {
    faceMatchThreshold: parseFloat(
      process.env.FACE_MATCH_THRESHOLD ?? `${DEFAULT_FACE_MATCH_THRESHOLD}`,
    ),
    geofenceRadiusM: parseFloat(
      process.env.GEOFENCE_RADIUS_M ?? `${DEFAULT_GEOFENCE_RADIUS_M}`,
    ),
    officeLatitude: parseFloat(process.env.OFFICE_LATITUDE ?? '41.311081'),
    officeLongitude: parseFloat(process.env.OFFICE_LONGITUDE ?? '69.240562'),
  },
});
