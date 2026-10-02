import type { GovAuthority } from './collectors/gov-uz.parser';

export type { GovAuthority };

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
  /** A state outlet (UzA, gov.uz ...) — items get the "Rasmiy" badge. */
  official?: boolean;
}

export interface MediaSettings {
  /** Surely the district: "Mirzo Ulug'bek tumani", "Мирзо-Улугбекский район". */
  keywords: string[];
  /** Ambiguous on their own (astronomer, street, metro): scored lower. */
  weakKeywords: string[];
  /** Cut out before matching: "Mirzo Ulug'bek nomidagi ...". */
  excludes: string[];
  /**
   * District places named without the district (massivs, landmarks). The
   * district's 70 mahallas come from the zones table automatically.
   */
  placeKeywords: string[];
  rssFeeds: MediaFeedConfig[];
  /** Public Telegram channel usernames (read via t.me/s/<name>, no token). */
  telegramChannels: string[];
  /** Telegram channels of state bodies (President's press secretary, UzA, parliament, city hokimligi ...). */
  officialTelegramChannels: string[];
  /** District-local channels: every post is kept (keyword or not), ads dropped. */
  localTelegramChannels: string[];
  /** Channels about Toshkent shahri — their posts count for the city filter without a keyword. */
  cityTelegramChannels: string[];
  /** Channels about Toshkent viloyati — likewise for the region filter. */
  regionTelegramChannels: string[];
  /** Spellings searched inside every Telegram channel (each channel writes the name differently). */
  telegramSearchQueries: string[];
  /** Keyless YouTube searches (newest first) — district videos from any channel. */
  youtubeSearchQueries: string[];
  /** Agency pages on the Government portal gov.uz (no RSS there — read from the page). */
  govAuthorities: GovAuthority[];
  /** Official domains for a second, site-restricted Google News search. */
  googleNewsSites: string[];
  /** YouTube channel ids (UC...) read via their public RSS, no key needed. */
  youtubeChannels: string[];
  /** State bodies' YouTube channels (city hokimligi, President's press service ...) — "Rasmiy". */
  officialYoutubeChannels: string[];
  /** The district hokimligi's own YouTube — every video counts. */
  ownYoutubeChannels: string[];
  /** YouTube Data API search query (only with YOUTUBE_API_KEY). */
  youtubeQuery: string;
  /** Instagram hashtags (without #) — Graph API hashtag search (needs Meta's Public Content Access). */
  instagramHashtags: string[];
  /** News outlets' public Instagram accounts (Business Discovery) — keyword-filtered. */
  instagramAccounts: string[];
  /** State bodies' Instagram accounts — «Rasmiy», keyword-filtered. */
  officialInstagramAccounts: string[];
  /** The district hokimligi's Instagram — every post counts. */
  ownInstagramAccounts: string[];
  /** Toshkent shahri hokimligi / city accounts — every post counts for the city filter. */
  cityInstagramAccounts: string[];
  /** Toshkent viloyati hokimligi / region accounts — every post counts for the region filter. */
  regionInstagramAccounts: string[];
  /** Google News search query (covers every outlet Google indexes). */
  googleNewsQuery: string;
  /** Items below this relevance are kept but hidden from the default view. */
  minRelevance: number;
  /** "AI tahlil" switch — Claude scoring/xulosa (needs ANTHROPIC_API_KEY). Off ⇒ rule engine. */
  aiEnabled: boolean;
  /** Which default source set a saved config already contains (see upgradeSources). */
  sourcesVersion: number;
}

/** Bump when default sources are added; saved configs then receive the new ones once. */
export const SOURCES_VERSION = 6;

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
  placeKeywords: ['TTZ', 'ТТЗ', 'Qorasuv', 'Қорасув', 'Карасу'],
  rssFeeds: [
    { key: 'kunuz', name: 'Kun.uz', url: 'https://kun.uz/news/rss', enabled: true },
    { key: 'daryo', name: 'Daryo', url: 'https://daryo.uz/rss/', enabled: true },
    { key: 'daryo-ru', name: 'Daryo (ru)', url: 'https://daryo.uz/ru/rss/', enabled: true },
    { key: 'gazeta', name: 'Gazeta.uz', url: 'https://www.gazeta.uz/uz/rss/', enabled: true },
    { key: 'gazeta-ru', name: 'Gazeta.uz (ru)', url: 'https://www.gazeta.uz/ru/rss/', enabled: true },
    { key: 'uza', name: 'UzA', url: 'https://uza.uz/uz/rss', enabled: true, official: true },
    { key: 'uza-ru', name: 'UzA (ru)', url: 'https://uza.uz/ru/rss', enabled: true, official: true },
    { key: 'podrobno', name: 'Podrobno.uz', url: 'https://podrobno.uz/rss/', enabled: true },
    { key: 'uznews', name: 'UzNews', url: 'https://www.uznews.uz/rss', enabled: true },
    { key: 'xabar', name: 'Xabar.uz', url: 'https://xabar.uz/uz/rss', enabled: true },
    { key: 'spot', name: 'Spot.uz', url: 'https://www.spot.uz/rss/', enabled: true },
    { key: 'nuz', name: 'Nuz.uz', url: 'https://nuz.uz/feed', enabled: true },
    { key: 'aniq', name: 'Aniq.uz', url: 'https://aniq.uz/rss', enabled: true },
    { key: 'zamin', name: 'Zamin.uz', url: 'https://zamin.uz/rss.xml', enabled: true },
    { key: 'review', name: 'Review.uz', url: 'https://review.uz/rss', enabled: true },
    { key: 'uzdaily', name: 'UzDaily', url: 'https://uzdaily.uz/uz/rss', enabled: true },
    { key: 'hook', name: 'Hook.report', url: 'https://hook.report/feed', enabled: true },
    // Added 2026-10-01 — each verified FROM THE SERVER: live, fresh, not a duplicate of another feed.
    { key: 'uza-oz', name: 'UzA (кирилл)', url: 'https://uza.uz/oz/rss', enabled: true, official: true },
    { key: 'uza-en', name: 'UzA (en)', url: 'https://uza.uz/en/rss', enabled: true, official: true },
    { key: 'lex-uz', name: 'Lex.uz — qonunchilik', url: 'https://lex.uz/uz/rss', enabled: true, official: true },
    { key: 'lex-ru', name: 'Lex.uz (ru)', url: 'https://lex.uz/ru/rss', enabled: true, official: true },
    { key: 'uznews-uz', name: 'UzNews (кирилл)', url: 'https://uznews.uz/uz/rss', enabled: true },
    { key: 'xabar-ru', name: 'Xabar.uz (ru)', url: 'https://xabar.uz/ru/rss', enabled: true },
    { key: 'nuz-uz', name: 'Nuz.uz (uz)', url: 'https://nuz.uz/uz/rss', enabled: true },
    { key: 'uzdaily-ru', name: 'UzDaily (ru)', url: 'https://uzdaily.uz/ru/rss', enabled: true },
    { key: 'uzdaily-en', name: 'UzDaily (en)', url: 'https://uzdaily.uz/en/rss', enabled: true },
    { key: 'anhor', name: 'Anhor.uz', url: 'https://anhor.uz/feed', enabled: true },
    { key: 'anhor-uz', name: 'Anhor.uz (uz)', url: 'https://anhor.uz/uz/feed', enabled: true },
    { key: 'kursiv', name: 'Kursiv Uzbekistan', url: 'https://uz.kursiv.media/uz/rss/', enabled: true },
    { key: 'kursiv-ru', name: 'Kursiv (ru)', url: 'https://uz.kursiv.media/ru/rss', enabled: true },
    { key: 'review-uz', name: 'Review.uz (uz)', url: 'https://review.uz/uz/feed', enabled: true },
    { key: 'review-oz', name: 'Review.uz (кирилл)', url: 'https://review.uz/oz/rss', enabled: true },
    { key: 'batafsil', name: 'Batafsil.uz', url: 'https://batafsil.uz/rss', enabled: true },
    { key: 'kapital', name: 'Kapital.uz', url: 'https://kapital.uz/rss', enabled: true },
    { key: 'tribuna', name: 'Tribuna.uz', url: 'https://tribuna.uz/rss.xml', enabled: true },
    { key: 'upl', name: 'Upl.uz', url: 'https://upl.uz/rss.xml', enabled: true },
    { key: 'nova24', name: 'Nova24', url: 'https://nova24.uz/rss', enabled: true },
    { key: 'pressa', name: 'Pressa.uz', url: 'https://pressa.uz/uz/rss', enabled: true },
    { key: 'vesti', name: 'Vesti.uz', url: 'https://vesti.uz/rss.xml', enabled: true },
    { key: 'sputnik-ru', name: 'Sputnik Узбекистан', url: 'https://uz.sputniknews.ru/export/rss2/archive/index.xml', enabled: true },
    { key: 'sputnik-uz', name: 'Sputnik (кирилл)', url: 'https://sputniknews.uz/export/rss2/archive/index.xml', enabled: true },
    { key: 'sputnik-oz', name: "Sputnik O'zbekiston", url: 'https://oz.sputniknews.uz/export/rss2/archive/index.xml', enabled: true },
    { key: 'mytashkent', name: 'MyTashkent', url: 'https://mytashkent.uz/rss', enabled: true },
    { key: 'gazeta-oz', name: 'Gazeta.uz (lotin)', url: 'https://www.gazeta.uz/oz/rss/', enabled: true },
    { key: 'spot-oz', name: 'Spot.uz (lotin)', url: 'https://www.spot.uz/oz/rss/', enabled: true },
  ],
  telegramChannels: [
    'kunuzofficial', 'daryo', 'gazetauz', 'uznews', 'qalampir', 'spotuz', 'aniquz', 'zaminuz',
    // Discovered from mentions/forwards inside the channels above (server-verified, active, ≥3K subs).
    'tyxuzbek', 'oblakouz', 'liveuz', 'kunuz', 'kunuzen', 'qalampirlive', 'qalampirfm', 'daryo_live',
    'nova24live', 'gazetauz_ozb', 'uznewsuzb', 'spotuz_uz', 'anhor_uzb', 'aniquzbek', 'sputnikuzbek',
    'millar_milliy', 'tashkentskiyekuranty',
    // Added 2026-10-01 (active, verified from the server). mirzo_ulugbek = local
    // district news channel (not the hokimlik); toshkent24/toshkentliklar = city.
    'mirzo_ulugbek', 'toshkent24', 'toshkentliklar', 'kunuzru', 'kun_uz', 'podrobno', 'repostuz',
    'pressauz', 'darakchi', 'uzreport_uz', 'sputnikuzbekistan', 'bbcuzbek', 'milliytv', 'nova24uz',
    'vestiuz', 'anhoruz', 'hook_report', 'kursivuz', 'reviewuz', 'terabaytuz', 'xushnudbek',
  ],
  // Verified 2026-10-01 (official names, active): President's press secretary,
  // UzA, O'zbekiston 24, Qonunchilik palatasi, Senat, Toshkent shahar hokimligi
  // matbuot xizmati, Bosh prokuratura.
  officialTelegramChannels: [
    'Press_Secretary_Uz',
    'uza_uz',
    'uzbekistan24',
    'qonunchilikpalatasi',
    'senatuz',
    'poytaxt_uz',
    'prokuratura_uz',
    'iivuz',
    'uzedu',
    'shmirziyoyev',
    'sshmirziyoyeva',
    'uz_kadastr',
    'codd_tashkent',
    'iivuz_tv',
    'matbuot_kotibi_uz',
    'eduuz',
  ],
  localTelegramChannels: ['mirzo_ulugbek'],
  // City hokimligi press service, city news channels, the city traffic centre.
  cityTelegramChannels: ['poytaxt_uz', 'toshkent24', 'toshkentliklar', 'tashkentskiyekuranty', 'codd_tashkent'],
  // The region hokimligi's own channel is silent since 2019 — its gov.uz page is read instead.
  regionTelegramChannels: [],
  // Verified 2026-10-01: kun.uz matches only "Улуғбек"/"Ulug‘bek", daryo "Ulug‘bek"/"Ulugʻbek",
  // gazeta "Ulugbek"/"Улугбек" — so every spelling is searched.
  telegramSearchQueries: ['Mirzo Ulug‘bek', 'Mirzo Ulugʻbek', 'Mirzo Ulugbek', 'Мирзо Улуғбек', 'Мирзо Улугбек', 'Мирзо-Улугбек'],
  youtubeSearchQueries: [
    "Mirzo Ulug'bek tumani",
    'Mirzo Ulugbek tumani',
    'Мирзо Улуғбек тумани',
    'Мирзо-Улугбекский район',
    "Mirzo Ulug'bek tumani hokimligi",
  ],
  govAuthorities: [
    { slug: 'mirzoulugbek', name: "Mirzo Ulug'bek tumani hokimligi", own: true },
    // Verified 2026-10-02: live news (the city's gov.uz page stopped in 2025 — its Telegram is used).
    { slug: 'toshvil', name: 'Toshkent viloyati hokimligi', own: false, area: 'region' },
    // Ministries / agencies with live news on gov.uz (verified 2026-10-01) — keyword-filtered.
    { slug: 'iiv', name: 'Ichki ishlar vazirligi', own: false },
    { slug: 'fvv', name: 'Favqulodda vaziyatlar vazirligi', own: false },
    { slug: 'ssv', name: "Sog'liqni saqlash vazirligi", own: false },
    { slug: 'uzedu', name: "Maktabgacha va maktab ta'limi vazirligi", own: false },
    { slug: 'mc', name: "Qurilish va uy-joy kommunal xo'jaligi vazirligi", own: false },
    { slug: 'eco', name: 'Ekologiya va iqlim agentligi', own: false },
    { slug: 'minenergy', name: 'Energetika vazirligi', own: false },
    { slug: 'mintrans', name: 'Transport vazirligi', own: false },
    { slug: 'uzavtoyul', name: "Avtomobil yo'llari qo'mitasi", own: false },
    { slug: 'kadastr', name: 'Kadastr agentligi', own: false },
    { slug: 'digital', name: 'Raqamli texnologiyalar vazirligi', own: false },
    { slug: 'adliya', name: 'Adliya vazirligi', own: false },
    { slug: 'yoshlar', name: 'Yoshlar ishlari agentligi', own: false },
    { slug: 'soliq', name: "Soliq qo'mitasi", own: false },
    { slug: 'sport', name: 'Sport vazirligi', own: false },
    { slug: 'madaniyat', name: 'Madaniyat vazirligi', own: false },
    { slug: 'uzbektourism', name: "Turizm qo'mitasi", own: false },
  ],
  googleNewsSites: ['gov.uz', 'president.uz', 'tashkent.uz', 'parliament.gov.uz', 'senat.uz', 'yuz.uz', 'xs.uz'],
  // Official channels (verified 2026-10-01): KunUZ, Daryo, Gazeta.uz (uz), Gazeta.uz (ru), UzA.
  youtubeChannels: [
    'UCVPst_iSyaVYpuOP4ogRhlw',
    'UC08XD1ERziLJyPER39tPQDw',
    'UCyAZcDf6qNqgS33gBYUCdIQ',
    'UCvbxjabiN6Rmb42OguPFAdA',
    'UC8VnKuevlppw9R4p12wA31A',
    // Added 2026-10-01 (active): Xabar.uz, Podrobno, Toshkentliklar24, O'zbekiston 24 radiosi.
    'UCKfAFbGa0w39d4RHMCtsGCw',
    'UCeeyfrVR6Mhm4d1O_6JEvVg',
    'UCJ7ZRiL-zspyi0u-r9fyBaA',
    'UCuEEUmuM5KHNmaPKnLL-P7w',
    // Found via keyless search for the district (verified active from the server):
    // UZREPORT TV, Anhor, Vaqt Uz, BBC Uzbek, Ozodlik, Bugungi masala, UZ Qurilish, F. Mahmudxo'jayev.
    'UCFVnOdIXSURzhSQLQhrILWQ',
    'UCOBl50C64XgaIhGk8lnzRAQ',
    'UCZb4Dwb3TjW8wn7iK5QWQSw',
    'UCQvZD_M4nzOSyrPx0LfgOmQ',
    'UCv9n8Z9zQ8luNEOnro9D_Cg',
    'UCSemEKDZHY_0s0HbHGDJUuw',
    'UCyD0rFiBqWI_JEG8STj75Qg',
    'UCi-CoG1aqqBKE7j2vE7pTjg',
  ],
  // Toshkent shahar hokimligi, Prezident press-xizmati, Toshkent shahar soliq boshqarmasi,
  // Toshkent shahar IIBB, Toshkent telekanali.
  officialYoutubeChannels: [
    'UC0lSmuOGz7tujTQIoop4UbA',
    'UC61Jnumjuz8NXhSuLoZD2xg',
    'UCMnak3ZKXeHNPujMSBgvQnw',
    'UCqvzVzj88MUAzRVJADyC0cQ',
    'UCcD0MhDDpGT-CEfO53zldtA',
  ],
  // "Mirzo Ulugbek tuman hokimligi Matbuot xizmati"
  ownYoutubeChannels: ['UC1agOw-aS7iHgozgkQJ9RAg'],
  youtubeQuery: '"Mirzo Ulug\'bek tumani"|"Мирзо-Улугбекский район"|"Mirzo Ulugbek tumani"',
  instagramHashtags: ['mirzoulugbektumani', 'mirzoulugbek'],
  // Every handle below is the one the outlet / agency links from its own site
  // or gov.uz page (checked 2026-10-02). Only professional accounts can be read.
  instagramAccounts: [
    'kun.uz', 'daryo.rasmiy', 'gazetauzbekistan', 'qalampir.uz', 'uznews', 'spot.uz', 'podrobno.uz', 'xabar.uz',
    'zamin.uz', 'anhor.uz', 'aniq.uz', 'repost.uz', 'nova24.uz', 'upl_uz', 'uzreport.news',
  ],
  // President, UzA, IIV, FVV, both Toshkent hokimliklar, ministries residents feel.
  officialInstagramAccounts: [
    'mirziyoyev_sh', 'uza.uz', 'iiv.uz', 'fvvmchs', 'toshshaharhokimlik', 'toshvilhokimlik', 'qurilishvazirligi',
    'energetika_vazirligi', 'transport_vazirligi', 'ecology_uzb', 'uz_kadastr', 'soliqpressa', 'yoshlaragentligi',
  ],
  // gov.uz/oz/mirzoulugbek links this account.
  ownInstagramAccounts: ['m.ulugbekhokimiyat'],
  cityInstagramAccounts: ['toshshaharhokimlik'],
  regionInstagramAccounts: ['toshvilhokimlik'],
  googleNewsQuery:
    '"Mirzo Ulug\'bek tumani" OR "Мирзо-Улугбекский район" OR "Мирзо-Улугбекском районе" OR "Mirzo Ulug\'bek hokimligi"',
  minRelevance: 50,
  aiEnabled: false,
  sourcesVersion: SOURCES_VERSION,
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
    placeKeywords: uniq(s.placeKeywords ?? d.placeKeywords),
    rssFeeds: (s.rssFeeds ?? d.rssFeeds).filter((f) => f && f.key && /^https?:\/\//i.test(f.url)),
    telegramChannels: uniq((s.telegramChannels ?? d.telegramChannels).map(cleanHandle)),
    officialTelegramChannels: uniq((s.officialTelegramChannels ?? d.officialTelegramChannels).map(cleanHandle)),
    localTelegramChannels: uniq((s.localTelegramChannels ?? d.localTelegramChannels).map(cleanHandle)),
    cityTelegramChannels: uniq((s.cityTelegramChannels ?? d.cityTelegramChannels).map(cleanHandle)),
    regionTelegramChannels: uniq((s.regionTelegramChannels ?? d.regionTelegramChannels).map(cleanHandle)),
    telegramSearchQueries: uniq(s.telegramSearchQueries ?? d.telegramSearchQueries).slice(0, 12),
    youtubeSearchQueries: uniq(s.youtubeSearchQueries ?? d.youtubeSearchQueries).slice(0, 12),
    govAuthorities: (s.govAuthorities ?? d.govAuthorities)
      .filter((a) => a && /^[a-z0-9-]{2,60}$/.test(a.slug))
      .map((a) => ({
        slug: a.slug,
        name: (a.name || a.slug).trim(),
        own: a.own === true,
        ...(a.area === 'city' || a.area === 'region' ? { area: a.area } : {}),
      })),
    googleNewsSites: uniq((s.googleNewsSites ?? d.googleNewsSites).map((x) => x.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase())),
    youtubeChannels: uniq(s.youtubeChannels ?? d.youtubeChannels),
    officialYoutubeChannels: uniq(s.officialYoutubeChannels ?? d.officialYoutubeChannels),
    ownYoutubeChannels: uniq(s.ownYoutubeChannels ?? d.ownYoutubeChannels),
    youtubeQuery: (s.youtubeQuery ?? d.youtubeQuery).trim(),
    instagramHashtags: uniq((s.instagramHashtags ?? d.instagramHashtags).map((h) => h.replace(/^#/, ''))),
    instagramAccounts: uniq((s.instagramAccounts ?? d.instagramAccounts).map(cleanHandle)),
    officialInstagramAccounts: uniq((s.officialInstagramAccounts ?? d.officialInstagramAccounts).map(cleanHandle)),
    ownInstagramAccounts: uniq((s.ownInstagramAccounts ?? d.ownInstagramAccounts).map(cleanHandle)),
    cityInstagramAccounts: uniq((s.cityInstagramAccounts ?? d.cityInstagramAccounts).map(cleanHandle)),
    regionInstagramAccounts: uniq((s.regionInstagramAccounts ?? d.regionInstagramAccounts).map(cleanHandle)),
    googleNewsQuery: (s.googleNewsQuery ?? d.googleNewsQuery).trim(),
    minRelevance: clamp(s.minRelevance ?? d.minRelevance, 0, 100),
    aiEnabled: s.aiEnabled === true,
    sourcesVersion: Number(s.sourcesVersion) || 1,
  };
}

/**
 * A config saved before new default sources existed would never see them.
 * Union the source lists with the defaults (one time per SOURCES_VERSION);
 * keywords and other choices stay as the hokimiyat left them.
 */
export function upgradeSources(s: MediaSettings): MediaSettings | null {
  if (s.sourcesVersion >= SOURCES_VERSION) return null;
  const d = DEFAULT_MEDIA_SETTINGS;
  const lower = (xs: string[]) => new Set(xs.map((x) => x.toLowerCase()));
  const tg = lower(s.telegramChannels);
  const otg = lower(s.officialTelegramChannels);
  return {
    ...s,
    rssFeeds: [...s.rssFeeds, ...d.rssFeeds.filter((f) => !s.rssFeeds.some((x) => x.key === f.key || x.url === f.url))],
    telegramChannels: [...s.telegramChannels, ...d.telegramChannels.filter((c) => !tg.has(c.toLowerCase()) && !otg.has(c.toLowerCase()))],
    officialTelegramChannels: [...s.officialTelegramChannels, ...d.officialTelegramChannels.filter((c) => !otg.has(c.toLowerCase()))],
    localTelegramChannels: [...s.localTelegramChannels, ...d.localTelegramChannels.filter((c) => !s.localTelegramChannels.includes(c))],
    cityTelegramChannels: [...s.cityTelegramChannels, ...d.cityTelegramChannels.filter((c) => !s.cityTelegramChannels.includes(c))],
    regionTelegramChannels: [...s.regionTelegramChannels, ...d.regionTelegramChannels.filter((c) => !s.regionTelegramChannels.includes(c))],
    youtubeChannels: [...s.youtubeChannels, ...d.youtubeChannels.filter((c) => !s.youtubeChannels.includes(c))],
    officialYoutubeChannels: [...s.officialYoutubeChannels, ...d.officialYoutubeChannels.filter((c) => !s.officialYoutubeChannels.includes(c))],
    ownYoutubeChannels: [...s.ownYoutubeChannels, ...d.ownYoutubeChannels.filter((c) => !s.ownYoutubeChannels.includes(c))],
    govAuthorities: [...s.govAuthorities, ...d.govAuthorities.filter((a) => !s.govAuthorities.some((x) => x.slug === a.slug))],
    googleNewsSites: [...s.googleNewsSites, ...d.googleNewsSites.filter((x) => !s.googleNewsSites.includes(x))],
    // The first defaults guessed two handles wrong (the outlets use daryo.rasmiy / gazetauzbekistan).
    instagramAccounts: addNew(s.instagramAccounts.map((a) => IG_RENAMED[a.toLowerCase()] ?? a), d.instagramAccounts),
    officialInstagramAccounts: addNew(s.officialInstagramAccounts, d.officialInstagramAccounts),
    ownInstagramAccounts: addNew(s.ownInstagramAccounts, d.ownInstagramAccounts),
    cityInstagramAccounts: addNew(s.cityInstagramAccounts, d.cityInstagramAccounts),
    regionInstagramAccounts: addNew(s.regionInstagramAccounts, d.regionInstagramAccounts),
    sourcesVersion: SOURCES_VERSION,
  };
}

const IG_RENAMED: Record<string, string> = { 'daryo.uz': 'daryo.rasmiy', 'gazeta.uz': 'gazetauzbekistan' };

/** `mine` plus the defaults it lacks (case-insensitive), in order. */
function addNew(mine: string[], defaults: string[]): string[] {
  const have = new Set(mine.map((x) => x.toLowerCase()));
  return uniq([...mine, ...defaults.filter((x) => !have.has(x.toLowerCase()))]);
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
