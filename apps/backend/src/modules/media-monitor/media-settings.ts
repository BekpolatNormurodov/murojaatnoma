/**
 * What the monitor watches and for which words. Stored as one JSON row
 * (media_settings.key = "config") so the hokimiyat can tune keywords and
 * channels from web-admin without a deploy; these are the defaults.
 */
export interface MediaFeedConfig {
  /** Stable key, also the MediaItem.source suffix ("rss:<key>"). */
  key: string;
  name: string;
  url: string;
  enabled: boolean;
}

export interface MediaSettings {
  /** Surely the district: "Mirzo Ulug'bek tumani", "Мирзо-Улугбекский район". */
  keywords: string[];
  /** Ambiguous on their own (astronomer, street, metro): scored lower. */
  weakKeywords: string[];
  /** Cut out before matching: "Mirzo Ulug'bek nomidagi ...". */
  excludes: string[];
  rssFeeds: MediaFeedConfig[];
  /** Public Telegram channel usernames (read via t.me/s/<name>, no token). */
  telegramChannels: string[];
  /** YouTube channel ids (UC...) read via their public RSS, no key needed. */
  youtubeChannels: string[];
  /** YouTube Data API search query (only with YOUTUBE_API_KEY). */
  youtubeQuery: string;
  /** Instagram hashtags (without #) — Graph API hashtag search. */
  instagramHashtags: string[];
  /** Public Instagram business/creator accounts to scan (Business Discovery). */
  instagramAccounts: string[];
  /** Google News search query (covers every outlet Google indexes). */
  googleNewsQuery: string;
  /** Items below this relevance are kept but hidden from the default view. */
  minRelevance: number;
}

export const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
  keywords: [
    "Mirzo Ulug'bek tuman",
    "Mirzo Ulug'bek hokim",
    // Uzbek Cyrillic folds onto this too (ғ→г in normalizeText).
    'Мирзо Улугбек туман',
    'Мирзо-Улугбекск',
    'Mirzo-Ulugbek district',
  ],
  weakKeywords: ["Mirzo Ulug'bek", 'Мирзо Улугбек'],
  excludes: [
    "Mirzo Ulug'bek nomidagi",
    'Мирзо Улугбек номидаги',
    'имени Мирзо Улугбека',
    "Mirzo Ulug'bek rasadxona",
    "Mirzo Ulug'bek metro",
    'метро Мирзо Улугбек',
  ],
  rssFeeds: [
    { key: 'kunuz', name: 'Kun.uz', url: 'https://kun.uz/news/rss', enabled: true },
    { key: 'daryo', name: 'Daryo', url: 'https://daryo.uz/rss/', enabled: true },
    { key: 'daryo-ru', name: 'Daryo (ru)', url: 'https://daryo.uz/ru/rss/', enabled: true },
    { key: 'gazeta', name: 'Gazeta.uz', url: 'https://www.gazeta.uz/uz/rss/', enabled: true },
    { key: 'gazeta-ru', name: 'Gazeta.uz (ru)', url: 'https://www.gazeta.uz/ru/rss/', enabled: true },
    { key: 'uza', name: 'UzA', url: 'https://uza.uz/uz/rss', enabled: true },
    { key: 'uza-ru', name: 'UzA (ru)', url: 'https://uza.uz/ru/rss', enabled: true },
    { key: 'podrobno', name: 'Podrobno.uz', url: 'https://podrobno.uz/rss/', enabled: true },
    { key: 'uznews', name: 'UzNews', url: 'https://www.uznews.uz/rss', enabled: true },
    { key: 'xabar', name: 'Xabar.uz', url: 'https://xabar.uz/uz/rss', enabled: true },
    { key: 'spot', name: 'Spot.uz', url: 'https://www.spot.uz/rss/', enabled: true },
  ],
  telegramChannels: ['kunuzofficial', 'daryo', 'gazetauz', 'uznews', 'qalampir', 'spotuz'],
  // Official channels (verified 2026-10-01): KunUZ, Daryo, Gazeta.uz (uz), Gazeta.uz (ru), UzA.
  youtubeChannels: [
    'UCVPst_iSyaVYpuOP4ogRhlw',
    'UC08XD1ERziLJyPER39tPQDw',
    'UCyAZcDf6qNqgS33gBYUCdIQ',
    'UCvbxjabiN6Rmb42OguPFAdA',
    'UC8VnKuevlppw9R4p12wA31A',
  ],
  youtubeQuery: '"Mirzo Ulug\'bek tumani"|"Мирзо-Улугбекский район"|"Mirzo Ulugbek tumani"',
  instagramHashtags: ['mirzoulugbektumani', 'mirzoulugbek'],
  instagramAccounts: ['kun.uz', 'daryo.uz', 'gazeta.uz'],
  googleNewsQuery:
    '"Mirzo Ulug\'bek tumani" OR "Мирзо-Улугбекский район" OR "Мирзо-Улугбекском районе" OR "Mirzo Ulug\'bek hokimligi"',
  minRelevance: 50,
};

const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];

/** Fills gaps from the defaults (older stored rows, partial PUTs). */
export function mergeSettings(stored: Partial<MediaSettings> | null | undefined): MediaSettings {
  const s = stored ?? {};
  const d = DEFAULT_MEDIA_SETTINGS;
  return {
    keywords: uniq(s.keywords ?? d.keywords),
    weakKeywords: uniq(s.weakKeywords ?? d.weakKeywords),
    excludes: uniq(s.excludes ?? d.excludes),
    rssFeeds: (s.rssFeeds ?? d.rssFeeds).filter((f) => f && f.key && /^https?:\/\//i.test(f.url)),
    telegramChannels: uniq((s.telegramChannels ?? d.telegramChannels).map(cleanHandle)),
    youtubeChannels: uniq(s.youtubeChannels ?? d.youtubeChannels),
    youtubeQuery: (s.youtubeQuery ?? d.youtubeQuery).trim(),
    instagramHashtags: uniq((s.instagramHashtags ?? d.instagramHashtags).map((h) => h.replace(/^#/, ''))),
    instagramAccounts: uniq((s.instagramAccounts ?? d.instagramAccounts).map(cleanHandle)),
    googleNewsQuery: (s.googleNewsQuery ?? d.googleNewsQuery).trim(),
    minRelevance: clamp(s.minRelevance ?? d.minRelevance, 0, 100),
  };
}

/** "@kunuz" / "https://t.me/kunuz" / "t.me/s/kunuz" → "kunuz". */
export function cleanHandle(h: string): string {
  return h
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^(www\.)?(t\.me|telegram\.me|instagram\.com)\/(s\/)?/i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '');
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
}
