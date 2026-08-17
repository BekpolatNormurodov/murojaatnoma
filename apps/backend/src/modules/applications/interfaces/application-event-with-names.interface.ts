import { ApplicationEvent } from '@prisma/client';

/**
 * An `ApplicationEvent` row enriched with human-readable names for its
 * (unrelated, plain-string) employee/department id fields. `ApplicationEvent`
 * intentionally has no Prisma relations to `Employee`/`Department` (schema is
 * shared with other modules and not something this module may change), so the
 * names are resolved with a couple of small follow-up lookups instead of a
 * Prisma `include`.
 */
export interface ApplicationEventWithNames extends ApplicationEvent {
  actorName: string | null;
  fromEmployeeName: string | null;
  toEmployeeName: string | null;
  departmentName: string | null;
}
