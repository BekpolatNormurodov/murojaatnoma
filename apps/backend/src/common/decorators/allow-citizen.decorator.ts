import { SetMetadata } from '@nestjs/common';

export const ALLOW_CITIZEN_KEY = 'allowCitizen';

/**
 * Opts a route (or whole controller) IN to CITIZEN-scope principals. Without
 * this marker, the global `CitizenAccessGuard` denies every citizen token —
 * secure by default. Put it ONLY on citizen-facing endpoints (e.g. a citizen
 * submitting/viewing their own applications), which must additionally scope
 * their results to the caller's phone. Employee/admin principals are unaffected.
 */
export const AllowCitizen = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(ALLOW_CITIZEN_KEY, true);
