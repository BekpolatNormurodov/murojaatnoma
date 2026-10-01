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
    /**
     * Fixed demo OTP code. When non-empty, /auth/request-otp stores THIS code
     * instead of a random one, so citizens can sign in with a known code while
     * no live SMS gateway is wired (e.g. "111111"). Leave empty in production
     * with real SMS. Length must satisfy OTP_CODE_REGEX (4-6 digits).
     */
    demoCode: string;
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
    /** Working weekdays, JS numbering (0 = Sunday … 6 = Saturday). */
    workDays: number[];
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
  /**
   * OAV monitoringi. Every key is optional: without them the monitor still runs
   * on RSS + Telegram + Google News with rule-based scoring; each key unlocks
   * one more source (or the AI xulosa).
   */
  media: {
    enabled: boolean;
    /** Claude API key — AI relevance/sentiment + the xulosa. Empty ⇒ rule-based. */
    anthropicApiKey: string;
    aiModel: string;
    /** YouTube Data API v3 key — keyword search across all of YouTube. Empty ⇒ channel RSS only. */
    youtubeApiKey: string;
    /** Instagram Graph API long-lived token + the connected IG business account id. */
    instagramAccessToken: string;
    instagramBusinessId: string;
    instagramGraphVersion: string;
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
    demoCode: process.env.OTP_DEMO_CODE ?? '',
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
    // e.g. WORK_DAYS=1,2,3,4,5,6 for a six-day week. Default Mon–Fri.
    workDays: (process.env.WORK_DAYS ?? '1,2,3,4,5')
      .split(',')
      .map((d) => parseInt(d.trim(), 10))
      .filter((d) => d >= 0 && d <= 6),
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
  media: {
    enabled: (process.env.MEDIA_MONITOR_ENABLED ?? 'true').toLowerCase() === 'true',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
    aiModel: process.env.MEDIA_AI_MODEL || 'claude-opus-5-5',
    youtubeApiKey: process.env.YOUTUBE_API_KEY ?? '',
    instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN ?? '',
    instagramBusinessId: process.env.INSTAGRAM_BUSINESS_ID ?? '',
    instagramGraphVersion: process.env.INSTAGRAM_GRAPH_VERSION || 'v24.0',
  },
});
