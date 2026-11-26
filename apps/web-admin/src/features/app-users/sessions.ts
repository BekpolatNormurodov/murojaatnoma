/* Mobil ilovalardan haqiqiy kirishlar: GET /app-users/sessions. */

export interface Session {
  id: string;
  startedAt: string;
  /** Oxirgi marta ilova sessiyani yangilagan payt. */
  lastSeenAt: string;
  expiresAt: string;
  device: string | null;
  platform: string | null;
  appVersion: string | null;
}

interface Person {
  id: string;
  name: string | null;
  phone: string;
  device: string | null;
  appVersion: string | null;
  lastSeenAt: string | null;
  sessions: Session[];
}

export interface EmployeeUser extends Person {
  position: string;
  avatarUrl: string | null;
  username: string | null;
  battery: number | null;
}

export interface CitizenUser extends Person {
  applications: number;
}

export interface SessionsOverview {
  employees: EmployeeUser[];
  citizens: CitizenUser[];
}

export type Kind = 'employees' | 'citizens';
export type Filter = 'all' | 'online' | 'signedIn' | 'signedOut';

/** Faol ilova sessiyani ~15 daqiqada bir yangilaydi. */
export const ONLINE_MINUTES = 20;

export const isOnline = (p: Pick<Person, 'lastSeenAt' | 'sessions'>, now = new Date()) =>
  p.sessions.length > 0 && !!p.lastSeenAt && now.getTime() - new Date(p.lastSeenAt).getTime() <= ONLINE_MINUTES * 60_000;

export function matches(p: Person, filter: Filter, query: string, now = new Date()): boolean {
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, '');
  const found =
    !q ||
    (p.name ?? '').toLowerCase().includes(q) ||
    (p.device ?? '').toLowerCase().includes(q) ||
    (digits.length >= 3 && p.phone.replace(/\D/g, '').includes(digits));
  if (!found) return false;
  if (filter === 'online') return isOnline(p, now);
  if (filter === 'signedIn') return p.sessions.length > 0;
  if (filter === 'signedOut') return p.sessions.length === 0;
  return true;
}

/** Hozir faollar, keyin kirganlar, oxirida kirmaganlar; ichida — yaqinda ko'ringani. */
export function sortPeople<T extends Person>(people: T[], now = new Date()): T[] {
  const rank = (p: T) => (isOnline(p, now) ? 0 : p.sessions.length ? 1 : 2);
  return [...people].sort(
    (a, b) => rank(a) - rank(b) || (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? '') || a.phone.localeCompare(b.phone),
  );
}
