/**
 * Business-rule constants that have a sensible default but may be overridden
 * via environment variables (see env.validation.ts / configuration.ts).
 */

/** Minimum face-recognition confidence score (0..1) required to accept an attendance scan. */
export const DEFAULT_FACE_MATCH_THRESHOLD = 0.7;

/** Maximum allowed distance (meters) from the office location to accept an attendance scan. */
export const DEFAULT_GEOFENCE_RADIUS_M = 150;

/** Default OTP validity window, in seconds. */
export const DEFAULT_OTP_TTL_SECONDS = 120;
