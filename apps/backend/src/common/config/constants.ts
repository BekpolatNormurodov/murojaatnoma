/**
 * Business-rule constants that have a sensible default but may be overridden
 * via environment variables (see env.validation.ts / configuration.ts).
 */

/** Minimum face-recognition confidence score (0..1) required to accept an attendance scan. */
export const DEFAULT_FACE_MATCH_THRESHOLD = 0.7;

/** Maximum allowed distance (meters) from the office location to accept an attendance scan. */
export const DEFAULT_GEOFENCE_RADIUS_M = 2000;

/** Default OTP validity window, in seconds. */
export const DEFAULT_OTP_TTL_SECONDS = 120;

/**
 * Office location the geofence is measured from. Aligned with the mobile
 * worker-app's Mirzo Ulug'bek district center (app_constants.dart) so the
 * server and the app agree on "inside the work zone".
 */
export const DEFAULT_OFFICE_LATITUDE = 41.3111;
export const DEFAULT_OFFICE_LONGITUDE = 69.3402;

/**
 * If an active employee has not reported a location for this many minutes,
 * the scheduler raises a "no location" alert notification. ("yarim soat")
 */
export const DEFAULT_STALE_LOCATION_MINUTES = 30;

/** How often (cron) the stale-location scanner runs. */
export const STALE_LOCATION_CRON = '*/5 * * * *';

/** Default employee work-day start time, as a local "HH:mm" string. */
export const DEFAULT_WORK_START = '09:00';

/** Default employee work-day end time, as a local "HH:mm" string. */
export const DEFAULT_WORK_END = '18:00';

/** Grace period (minutes) after work start before a CHECK_IN is counted as late. */
export const LATE_GRACE_MINUTES = 5;
