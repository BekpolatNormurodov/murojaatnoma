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
    /** Dev convenience: echo the generated OTP code back in the response. */
    devEcho: boolean;
  };
  attendance: {
    faceMatchThreshold: number;
    geofenceRadiusM: number;
    officeLatitude: number;
    officeLongitude: number;
  };
  location: {
    staleMinutes: number;
  };
  work: {
    startTime: string;
    endTime: string;
    lateGraceMinutes: number;
  };
  admin: {
    seedUsername: string;
    seedPassword: string;
    seedFullName: string;
    seedDemoData: boolean;
  };
  uploads: {
    /** On-disk directory attachment uploads (photo/video/voice) are written to. */
    dir: string;
    /** Public origin used to build the attachment URL returned to clients: `${publicBaseUrl}/uploads/<file>`. */
    publicBaseUrl: string;
  };
  firebase: {
    /** Firebase project id (informational; the real credential is the service account). */
    projectId: string;
    /** Base64-encoded service-account JSON. Empty ⇒ push notifications disabled. */
    serviceAccountB64: string;
  };
  /** WebRTC signaling (realtime calls). STUN is always on; TURN is optional. */
  realtime: {
    /** TURN server URL, e.g. "turn:turn.murojaatnoma.uz:3478". Empty ⇒ STUN-only. */
    turnUrl: string;
    turnUsername: string;
    turnCredential: string;
    /** Seconds an unanswered call rings before it is marked "missed". */
    ringTimeoutSec: number;
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
    devEcho: (process.env.OTP_DEV_ECHO ?? 'false').toLowerCase() === 'true',
  },
  attendance: {
    faceMatchThreshold: parseFloat(
      process.env.FACE_MATCH_THRESHOLD ?? `${DEFAULT_FACE_MATCH_THRESHOLD}`,
    ),
    geofenceRadiusM: parseFloat(
      process.env.GEOFENCE_RADIUS_M ?? `${DEFAULT_GEOFENCE_RADIUS_M}`,
    ),
    officeLatitude: parseFloat(process.env.OFFICE_LATITUDE ?? `${DEFAULT_OFFICE_LATITUDE}`),
    officeLongitude: parseFloat(
      process.env.OFFICE_LONGITUDE ?? `${DEFAULT_OFFICE_LONGITUDE}`,
    ),
  },
  location: {
    staleMinutes: parseInt(
      process.env.STALE_LOCATION_MINUTES ?? `${DEFAULT_STALE_LOCATION_MINUTES}`,
      10,
    ),
  },
  work: {
    startTime: process.env.WORK_START_TIME ?? DEFAULT_WORK_START,
    endTime: process.env.WORK_END_TIME ?? DEFAULT_WORK_END,
    lateGraceMinutes: parseInt(
      process.env.LATE_GRACE_MINUTES ?? `${LATE_GRACE_MINUTES}`,
      10,
    ),
  },
  admin: {
    seedUsername: process.env.ADMIN_USERNAME ?? 'admin',
    seedPassword: process.env.ADMIN_PASSWORD ?? '',
    seedFullName: process.env.ADMIN_FULL_NAME ?? 'Bosh administrator',
    seedDemoData: (process.env.SEED_DEMO_DATA ?? 'true').toLowerCase() === 'true',
  },
  uploads: {
    dir: process.env.UPLOADS_DIR ?? DEFAULT_UPLOADS_DIR,
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? DEFAULT_PUBLIC_BASE_URL,
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    serviceAccountB64: process.env.FIREBASE_SERVICE_ACCOUNT_B64 ?? '',
  },
  realtime: {
    turnUrl: process.env.TURN_URL ?? '',
    turnUsername: process.env.TURN_USERNAME ?? '',
    turnCredential: process.env.TURN_CREDENTIAL ?? '',
    ringTimeoutSec: parseInt(process.env.CALL_RING_TIMEOUT_SEC ?? '35', 10),
  },
});
