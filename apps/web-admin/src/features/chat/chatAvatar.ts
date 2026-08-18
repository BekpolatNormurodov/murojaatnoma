/**
 * Deterministic avatar color for a DM opened from the live employee list
 * (map or the "Xodimga yozish" picker) — the live location source doesn't
 * carry an `avatarColor` field, so we derive a stable one from the
 * employee id instead of hard-coding/faking one.
 */
const AVATAR_COLORS = [
  '#10b981',
  '#3b82f6',
  '#a855f7',
  '#f59e0b',
  '#ef4444',
  '#06b6d4',
  '#ec4899',
  '#8b5cf6',
  '#0ea5e9',
  '#64748b',
];

export function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
