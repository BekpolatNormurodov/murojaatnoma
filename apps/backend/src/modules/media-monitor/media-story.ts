import { normalizeText, stripHandles } from './media-text.util';

/**
 * Story grouping: the same event reported by Kun.uz, Aniq.uz and a Telegram
 * channel — in Latin or Cyrillic Uzbek — becomes ONE story with "+2 manbada"
 * instead of three cards. Titles are transliterated to Latin, reduced to
 * 5-letter stems without stop words and without the district's own name
 * (shared by every item, it would glue unrelated stories), then compared.
 */

const CYR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 's', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '',
  ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

/** Cyrillic (Uzbek + Russian) → rough Latin, so "Ҳоким" and "Hokim" compare equal. */
export function translit(s: string): string {
  return s.toLowerCase().replace(/[а-яёўқғҳ]/g, (c) => CYR[c] ?? c);
}

const STOP = new Set([
  // uz
  'va', 'bilan', 'uchun', 'bu', 'ham', 'emas', 'edi', 'bolgan', 'boldi', 'qildi', 'etdi', 'deb', 'dan', 'ning', 'yil',
  'yilda', 'kuni', 'haqida', 'boyicha', 'yana', 'endi', 'qanday', 'nima', 'kim', 'hamda', 'lekin', 'ammo', 'yangi',
  // ru (transliterated)
  'na', 'po', 'dlya', 'iz', 'chto', 'kak', 'eto', 'pri', 'ot', 'do', 'vo', 'ne', 'ego', 'ee', 'ili', 'uje', 'god', 'goda',
  // district / city words every item shares
  'mirzo', 'ulugb', 'tuman', 'raion', 'rayon', 'toshk', 'tashk', 'shaha', 'xokim', 'hokim', 'mahal', 'maxal',
]);

/** Distinctive 5-letter stems of a title. */
export function storyTokens(title: string): Set<string> {
  const t = normalizeText(translit(stripHandles(title)))
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w))
    .map((w) => w.slice(0, 5))
    .filter((w) => !STOP.has(w));
  return new Set(t);
}

/** Overlap of two token sets: shared / smaller set, with at least 3 shared stems. */
export function storySimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  if (shared < 3) return 0;
  return shared / Math.min(a.size, b.size);
}

export const SAME_STORY = 0.6;
/** Only items this close in time can be one story. */
export const STORY_WINDOW_MS = 72 * 3_600_000;

export interface StoryCandidate {
  id: string;
  title: string;
  publishedAt: Date;
  storyId: string | null;
  relevance: number;
  official: boolean;
}

export interface StoryAssignment {
  id: string;
  storyId: string;
  isStoryLead: boolean;
}

/**
 * Assigns each `fresh` item to a story among `known` (already grouped) and
 * the fresh items before it. A story's lead is its most relevant item
 * (official breaks ties) — when a better item joins, the lead moves.
 */
export function assignStories(fresh: StoryCandidate[], known: StoryCandidate[]): StoryAssignment[] {
  const pool = known.map((k) => ({ ...k, tokens: storyTokens(k.title), storyId: k.storyId ?? k.id }));
  const leads = new Map<string, { id: string; relevance: number; official: boolean }>();
  for (const k of pool) {
    const cur = leads.get(k.storyId);
    if (!cur || better(k, cur)) leads.set(k.storyId, { id: k.id, relevance: k.relevance, official: k.official });
  }
  const changed = new Map<string, StoryAssignment>();
  for (const f of [...fresh].sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime())) {
    const tokens = storyTokens(f.title);
    let best: (typeof pool)[number] | null = null;
    let bestSim = 0;
    for (const k of pool) {
      if (Math.abs(k.publishedAt.getTime() - f.publishedAt.getTime()) > STORY_WINDOW_MS) continue;
      const sim = storySimilarity(tokens, k.tokens);
      if (sim > bestSim) {
        bestSim = sim;
        best = k;
      }
    }
    const storyId = best && bestSim >= SAME_STORY ? best.storyId : f.id;
    pool.push({ ...f, tokens, storyId });
    const lead = leads.get(storyId);
    if (!lead) {
      leads.set(storyId, { id: f.id, relevance: f.relevance, official: f.official });
      changed.set(f.id, { id: f.id, storyId, isStoryLead: true });
    } else if (better(f, lead)) {
      changed.set(lead.id, { id: lead.id, storyId, isStoryLead: false });
      leads.set(storyId, { id: f.id, relevance: f.relevance, official: f.official });
      changed.set(f.id, { id: f.id, storyId, isStoryLead: true });
    } else {
      changed.set(f.id, { id: f.id, storyId, isStoryLead: false });
    }
  }
  return [...changed.values()];
}

function better(a: { relevance: number; official: boolean }, b: { relevance: number; official: boolean }): boolean {
  if (a.relevance !== b.relevance) return a.relevance > b.relevance;
  return a.official && !b.official;
}
