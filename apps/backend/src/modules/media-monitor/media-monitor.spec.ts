import { parseFeed } from './collectors/feed.parser';
import { parseTelegramPreview } from './collectors/telegram.parser';
import { analyzeByRules, digestByRules, extractJson } from './media-analyzer';
import { DEFAULT_MEDIA_SETTINGS as S, cleanHandle, mergeSettings } from './media-settings';
import {
  fingerprintOf,
  htmlToText,
  matchKeywords,
  normalizeText,
  parseCompactNumber,
  parseFeedDate,
  relevanceFromMatch,
} from './media-text.util';

const match = (title: string, body = '') => matchKeywords(title, body, S.keywords, S.weakKeywords, S.excludes);

describe('media text utils', () => {
  it('folds apostrophe variants, Uzbek Cyrillic and dashes', () => {
    expect(normalizeText("Mirzo Ulugʻbek")).toBe('mirzo ulugbek');
    expect(normalizeText("Mirzo Ulug‘bek")).toBe('mirzo ulugbek');
    expect(normalizeText('Mirzo Ulug`bek')).toBe('mirzo ulugbek');
    expect(normalizeText('Мирзо Улуғбек')).toBe('мирзо улугбек');
    expect(normalizeText('Мирзо-Улугбекский  район')).toBe('мирзо улугбекский район');
  });

  it('matches the district in every spelling, strong vs weak', () => {
    expect(match("Mirzo Ulugʻbek tumanida yangi maktab ochildi").strong.length).toBeGreaterThan(0);
    expect(match('Новый парк в Мирзо-Улугбекском районе').strong.length).toBeGreaterThan(0);
    expect(match('Мирзо Улуғбек туманида сув таъминоти').strong.length).toBeGreaterThan(0);
    const weak = match("Mirzo Ulug'bek ko'chasida tirbandlik");
    expect(weak.strong).toEqual([]);
    expect(weak.weak.length).toBe(1);
    expect(match('Toshkentda ob-havo').weak).toEqual([]);
  });

  it('cuts exclude phrases (the university named after the astronomer)', () => {
    const m = match("Mirzo Ulug'bek nomidagi O'zbekiston Milliy universiteti talabalari");
    expect(m.strong).toEqual([]);
    expect(m.weak).toEqual([]);
    // ...but the district mentioned elsewhere still counts
    expect(match("Mirzo Ulug'bek nomidagi universitet Mirzo Ulug'bek tumanida joylashgan").strong.length).toBe(1);
  });

  it('scores relevance from the evidence', () => {
    expect(relevanceFromMatch(match("Mirzo Ulug'bek tumani hokimi qabul o'tkazdi"), false)).toBeGreaterThanOrEqual(90);
    expect(relevanceFromMatch(match('Yangilik', "matnda Mirzo Ulug'bek tumani"), false)).toBe(80);
    expect(relevanceFromMatch(match('Yangilik', "Mirzo Ulug'bek haqida"), false)).toBe(45);
    expect(relevanceFromMatch(match('Yangilik'), true)).toBe(35);
    expect(relevanceFromMatch(match('Yangilik'), false)).toBe(0);
  });

  it('fingerprints the same story from Google News and the outlet equally', () => {
    expect(fingerprintOf('Yangi park ochildi - Kun.uz')).toBe(fingerprintOf('Yangi park ochildi'));
    expect(fingerprintOf('Yangi park ochildi')).not.toBe(fingerprintOf('Yangi maktab ochildi'));
  });

  it('parses compact counters and clamps future dates', () => {
    expect(parseCompactNumber('12.3K')).toBe(12_300);
    expect(parseCompactNumber('1,2M')).toBe(1_200_000);
    expect(parseCompactNumber('845')).toBe(845);
    const now = new Date('2026-10-01T10:00:00Z');
    expect(parseFeedDate('2027-01-01T00:00:00Z', now)).toBe(now);
    expect(parseFeedDate('garbage', now)).toBe(now);
    expect(parseFeedDate('Thu, 01 Oct 2026 08:09:19 +0500', now).toISOString()).toBe('2026-10-01T03:09:19.000Z');
  });

  it('turns HTML into readable text', () => {
    expect(htmlToText('<b>Salom</b><br/>dunyo &amp; <i>bizlar</i> &#8212; ok')).toBe('Salom\ndunyo & bizlar — ok');
  });
});

describe('feed parser', () => {
  it('reads RSS 2.0 with CDATA, enclosure and source', () => {
    const xml = `<rss><channel><title>X</title>
      <item><guid>https://kun.uz/news/1</guid><title>Mirzo Ulugʻbek tumanida yo‘l ta’mirlandi</title>
        <link>https://kun.uz/news/1</link>
        <description><![CDATA[<p>Matn <b>qalin</b></p>]]>.</description>
        <pubDate>Thu, 01 Oct 2026 18:09:19 +0500</pubDate>
        <enclosure url="https://cdn.kun.uz/a.jpg" type="image/jpeg"/>
        <source url="https://kun.uz">Kun.uz</source>
      </item>
      <item><title></title><link>https://x</link></item>
    </channel></rss>`;
    const [e, ...rest] = parseFeed(xml);
    expect(rest).toEqual([]);
    expect(e.title).toBe('Mirzo Ulugʻbek tumanida yo‘l ta’mirlandi');
    expect(e.link).toBe('https://kun.uz/news/1');
    expect(e.description).toBe('Matn qalin\n.');
    expect(e.imageUrl).toBe('https://cdn.kun.uz/a.jpg');
    expect(e.sourceName).toBe('Kun.uz');
  });

  it('reads a YouTube Atom feed', () => {
    const xml = `<feed><title>KunUZ</title><entry><id>yt:video:abc</id><yt:videoId>abc</yt:videoId>
      <title>Video &amp; sarlavha</title><link rel="alternate" href="https://www.youtube.com/watch?v=abc"/>
      <author><name>KunUZ</name></author><published>2026-10-01T05:00:00+00:00</published>
      <media:group><media:thumbnail url="https://i1.ytimg.com/vi/abc/hqdefault.jpg" width="480"/>
      <media:description>Tavsif</media:description>
      <media:community><media:statistics views="1234"/></media:community></media:group></entry></feed>`;
    const [e] = parseFeed(xml);
    expect(e.videoId).toBe('abc');
    expect(e.title).toBe('Video & sarlavha');
    expect(e.link).toBe('https://www.youtube.com/watch?v=abc');
    expect(e.author).toBe('KunUZ');
    expect(e.views).toBe(1234);
    expect(e.imageUrl).toBe('https://i1.ytimg.com/vi/abc/hqdefault.jpg');
    expect(e.description).toBe('Tavsif');
  });
});

describe('telegram preview parser', () => {
  it('extracts posts with text, photo, views and time; skips media-only posts', () => {
    const html = `<meta property="og:title" content="Daryo | Rasmiy kanal">
      <div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="Daryo/10">
        <a class="tgme_widget_message_photo_wrap 1" href="https://t.me/Daryo/10" style="width:800px;background-image:url('https://cdn4.telesco.pe/file/p.jpg')"></a>
        <div class="tgme_widget_message_text js-message_text" dir="auto"><b>Mirzo Ulugʻbek tumanida</b><br/>suv taʼminoti tiklandi</div>
        <span class="tgme_widget_message_views">12.3K</span><time datetime="2026-09-30T14:45:15+00:00" class="time">19:45</time>
      </div></div>
      <div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="Daryo/11">
        <a class="tgme_widget_message_photo_wrap"></a></div></div>`;
    const items = parseTelegramPreview(html, 'Daryo', new Date('2026-10-01T00:00:00Z'));
    expect(items).toHaveLength(1);
    const [p] = items;
    expect(p.source).toBe('tg:daryo');
    expect(p.sourceName).toBe('Daryo | Rasmiy kanal');
    expect(p.url).toBe('https://t.me/Daryo/10');
    expect(p.title).toBe('Mirzo Ulugʻbek tumanida');
    expect(p.text).toBe('suv taʼminoti tiklandi');
    expect(p.imageUrl).toBe('https://cdn4.telesco.pe/file/p.jpg');
    expect(p.views).toBe(12_300);
    expect(p.publishedAt.toISOString()).toBe('2026-09-30T14:45:15.000Z');
  });
});

describe('rule analyzer', () => {
  const rules = (title: string, text = '') => analyzeByRules({ id: '1', sourceName: 'x', title, text, relevance: 80 });

  it('scores sentiment and topic in Uzbek and Russian', () => {
    expect(rules("Mirzo Ulug'bek tumanida aholi suv yo'qligidan shikoyat qilmoqda").sentiment).toBe('negative');
    expect(rules("Mirzo Ulug'bek tumanida yangi maktab foydalanishga topshirildi").sentiment).toBe('positive');
    expect(rules('В Мирзо-Улугбекском районе произошел пожар').sentiment).toBe('negative');
    expect(rules('В Мирзо-Улугбекском районе нашли килограмм марихуаны').sentiment).toBe('negative');
    expect(rules("Mirzo Ulug'bek tumanida yangi maktab foydalanishga topshirildi").topic).toBe("Ta'lim");
    expect(rules('Отключение газа: без газа остались дома').topic).toBe('Kommunal xizmatlar');
  });

  it('writes a rule-based digest with risks for negative items', () => {
    const at = new Date('2026-10-01T05:00:00Z');
    const base = { sourceName: 'Kun.uz', platform: 'web', publishedAt: at, summary: null, relevance: 90 };
    const d = digestByRules(
      [
        { ...base, id: 'a', title: 'Suv yo‘q', sentiment: 'negative', topic: 'Kommunal xizmatlar' },
        { ...base, id: 'b', title: 'Park ochildi', sentiment: 'positive', topic: 'Qurilish va obodonlashtirish' },
      ],
      24,
    );
    expect(d.model).toBe('rules');
    expect(d.headline).toContain('1 tasi salbiy');
    expect(d.risks).toHaveLength(1);
    expect(d.risks[0]).toMatchObject({ itemIds: ['a'], level: 'high' });
    expect(d.recommendations.length).toBeGreaterThan(0);
    expect(digestByRules([], 24).headline).toContain('topilmadi');
  });

  it('extracts JSON from a fenced model reply', () => {
    expect(extractJson<{ a: number }>('Mana:\n```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson<number[]>('[1,2]')).toEqual([1, 2]);
    expect(() => extractJson('no json')).toThrow();
  });
});

describe('media settings', () => {
  it('cleans handles and fills defaults', () => {
    expect(cleanHandle('https://t.me/s/kunuzofficial')).toBe('kunuzofficial');
    expect(cleanHandle('@daryo')).toBe('daryo');
    expect(cleanHandle('https://www.instagram.com/kun.uz/')).toBe('kun.uz');
    const m = mergeSettings({ keywords: ['  a ', 'a', ''], minRelevance: 400 });
    expect(m.keywords).toEqual(['a']);
    expect(m.minRelevance).toBe(100);
    expect(m.rssFeeds.length).toBe(S.rssFeeds.length);
    // AI is opt-in: off unless explicitly switched on.
    expect(m.aiEnabled).toBe(false);
    expect(mergeSettings({ aiEnabled: true }).aiEnabled).toBe(true);
    expect(mergeSettings({ aiEnabled: 'true' as unknown as boolean }).aiEnabled).toBe(false);
  });
});

describe('instagram collector', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;

  it('finds the business account from the token when INSTAGRAM_BUSINESS_ID is empty', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: string | URL | Request) => {
      const u = String(url);
      urls.push(u);
      if (u.includes('/me/accounts')) return json({ data: [{ id: 'page1' }, { id: 'page2', instagram_business_account: { id: '1784IG' } }] });
      if (u.includes('business_discovery')) {
        return json({
          business_discovery: {
            username: 'kun.uz',
            name: 'Kun.uz',
            media: { data: [{ id: 'm1', caption: "Mirzo Ulug'bek tumanida yangi park", permalink: 'https://instagram.com/p/1', timestamp: '2026-10-01T05:00:00+0000', media_type: 'IMAGE', media_url: 'https://cdn/x.jpg' }] },
          },
        });
      }
      return json({ data: [] });
    }) as typeof fetch;
    const { collectInstagram } = await import('./collectors/collectors');
    const r = await collectInstagram(
      { token: 'tok-a', businessId: '', version: 'v24.0' },
      { instagramHashtags: [], instagramAccounts: ['kun.uz'] },
      new Map(),
      new Date('2026-10-01T10:00:00Z'),
    );
    expect(r.error).toBeUndefined();
    expect(urls[0]).toContain('/me/accounts');
    expect(urls[1]).toContain('/1784IG?fields=');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ platform: 'instagram', sourceName: 'Kun.uz', url: 'https://instagram.com/p/1' });
  });

  it('explains what to do when no Page has an Instagram account linked', async () => {
    global.fetch = jest.fn(async () => json({ data: [{ id: 'page1' }] })) as typeof fetch;
    const { collectInstagram } = await import('./collectors/collectors');
    const r = await collectInstagram({ token: 'tok-b', businessId: '', version: 'v24.0' }, { instagramHashtags: ['x'], instagramAccounts: [] }, new Map(), new Date());
    expect(r.items).toEqual([]);
    expect(r.error).toContain('INSTAGRAM_BUSINESS_ID');
  });

  it('is skipped without a token', async () => {
    const { collectInstagram } = await import('./collectors/collectors');
    const r = await collectInstagram({ token: '', businessId: '', version: 'v24.0' }, { instagramHashtags: [], instagramAccounts: [] }, new Map(), new Date());
    expect(r.skipped).toContain('INSTAGRAM_ACCESS_TOKEN');
  });
});

describe('gov.uz portal parser', () => {
  it('reads the news list from the Next.js RSC payload', async () => {
    const { parseGovUzNews } = await import('./collectors/gov-uz.parser');
    const payload =
      '6:["$","$f",null,{"children":["$","$L26",null,{"authority":"mirzoulugbek","data":{"data":[' +
      '{"id":222547,"date":"2026-09-22 17:20:00","title":"Shaxsiy qabullar \\"yechim\\" [1]","anons":"Hokim o‘rinbosarlari qabul o‘tkazdi.","views":330,"anons_image":"https://api-portal.gov.uz/a.jpg"},' +
      '{"id":222548,"date":"2026-09-04 10:50:00","title":"Ikkinchi","anons":"","views":5,"anons_image":""}' +
      '],"total":2}}]}]';
    // Split across two pushes like the real page does.
    const half = Math.floor(payload.length / 2);
    const html =
      `<script>self.__next_f.push([1,${JSON.stringify(payload.slice(0, half))}])</script>` +
      `<script>self.__next_f.push([1,${JSON.stringify(payload.slice(half))}])</script>`;
    const items = parseGovUzNews(html, { slug: 'mirzoulugbek', name: "Mirzo Ulug'bek tumani hokimligi", own: true }, new Date('2026-10-01T00:00:00Z'));
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      source: 'gov:mirzoulugbek',
      externalId: '222547',
      url: 'https://gov.uz/oz/mirzoulugbek/news/view/222547',
      title: 'Shaxsiy qabullar "yechim" [1]',
      text: 'Hokim o‘rinbosarlari qabul o‘tkazdi.',
      imageUrl: 'https://api-portal.gov.uz/a.jpg',
      views: 330,
      official: true,
      alwaysRelevant: true,
    });
    // Local Tashkent time → UTC
    expect(items[0].publishedAt.toISOString()).toBe('2026-09-22T12:20:00.000Z');
    expect(items[1].imageUrl).toBeUndefined();
    expect(parseGovUzNews('<html></html>', { slug: 'x', name: 'x', own: false })).toEqual([]);
  });
});

describe('official Google results', () => {
  it('drops portal pages that are just the agency name or contacts', async () => {
    const { isPortalPage } = await import('./collectors/collectors');
    expect(isPortalPage('Тошкент шаҳар Мирзо Улуғбек тумани ҳокимлиги')).toBe(true);
    expect(isPortalPage('Хокимият Мирзо-Улугбекского района города Ташкента')).toBe(true);
    expect(isPortalPage('Контакты')).toBe(true);
    expect(isPortalPage("Mirzo Ulug'bek tumanida yangi maktab foydalanishga topshirildi")).toBe(false);
    expect(isPortalPage('В Мирзо-Улугбекском районе внедряется цифровое управление и новая модель безопасности')).toBe(false);
    expect(isPortalPage('ЛИЧНЫЕ ПРИЁМЫ — ОСНОВА ДЛЯ РЕШЕНИЯ ПРОБЛЕМ')).toBe(false);
  });
});

describe('default-source upgrade', () => {
  it('adds new default sources to an old saved config once, keeping custom ones', async () => {
    const { upgradeSources, mergeSettings: merge, SOURCES_VERSION } = await import('./media-settings');
    const old = merge({ rssFeeds: [{ key: 'mine', name: 'Mine', url: 'https://example.uz/rss', enabled: true }], telegramChannels: ['mychannel'], keywords: ['x'] });
    expect(old.sourcesVersion).toBe(1);
    const up = upgradeSources(old)!;
    expect(up.sourcesVersion).toBe(SOURCES_VERSION);
    expect(up.rssFeeds[0].key).toBe('mine');
    expect(up.rssFeeds.some((f) => f.key === 'kunuz')).toBe(true);
    expect(up.telegramChannels).toContain('mychannel');
    expect(up.telegramChannels).toContain('mirzo_ulugbek');
    expect(up.govAuthorities.some((a) => a.slug === 'iiv')).toBe(true);
    expect(up.keywords).toEqual(['x']);
    expect(upgradeSources(up)).toBeNull();
  });
});

describe('telegram depth + youtube web search', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });
  const page = (ch: string, posts: { id: number; text: string; at: string }[]) =>
    `<meta property="og:title" content="${ch} kanal">` +
    posts
      .map(
        (p) =>
          `<div class="tgme_widget_message_wrap js-widget_message_wrap"><div class="tgme_widget_message" data-post="${ch}/${p.id}">` +
          `<div class="tgme_widget_message_text js-message_text">${p.text}</div><time datetime="${p.at}"></time></div></div>`,
      )
      .join('');
  const ok = (body: string) => ({ ok: true, status: 200, text: async () => body }) as unknown as Response;

  it('pages back with ?before=, searches each spelling, de-duplicates and drops ads', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (u: string | URL | Request) => {
      const url = String(u);
      urls.push(url);
      if (url.includes('?before=100')) return ok(page('Kun', [{ id: 98, text: 'Eski xabar', at: '2026-09-20T10:00:00Z' }]));
      if (url.includes('?before=')) return ok(page('Kun', []));
      if (url.includes('?q=')) return ok(page('Kun', [{ id: 50, text: "Mirzo Ulug‘bek tumanida yo'l ta'mirlandi", at: '2026-09-10T10:00:00Z' }, { id: 101, text: 'Yangi', at: '2026-10-01T09:00:00Z' }]));
      return ok(page('Kun', [{ id: 101, text: 'Yangi', at: '2026-10-01T09:00:00Z' }, { id: 100, text: '#reklama Chegirma!', at: '2026-10-01T08:00:00Z' }, { id: 102, text: 'Ikkinchi', at: '2026-10-01T10:00:00Z' }]));
    }) as typeof fetch;
    const { collectTelegram } = await import('./collectors/collectors');
    const r = await collectTelegram('Kun', new Date('2026-10-01T12:00:00Z'), false, { pages: 3, queries: ['Mirzo Ulug‘bek', 'Мирзо Улуғбек'] });
    const ids = r.items.map((i) => i.externalId).sort();
    expect(ids).toEqual(['Kun/101', 'Kun/102', 'Kun/50', 'Kun/98'].sort());
    expect(r.items.find((i) => i.externalId === 'Kun/50')?.backfill).toBe(true);
    expect(r.items.find((i) => i.externalId === 'Kun/101')?.backfill).toBeUndefined();
    expect(urls.filter((u) => u.includes('?q=')).length).toBe(2);
    // the ad (100) is dropped but still anchors paging, so no range is read twice
    expect(urls.some((u) => u.includes('?before=100'))).toBe(true);
  });

  it('parses YouTube results and relative upload times', async () => {
    const { parseYoutubeResults, parseRelativeAgo } = await import('./collectors/collectors');
    const data = { contents: { a: [{ videoRenderer: { videoId: 'abc', title: { runs: [{ text: "Mirzo Ulug'bek tumani" }] }, publishedTimeText: { simpleText: '10 hours ago' } } }, { other: 1 }] } };
    const html = `<script>var ytInitialData = ${JSON.stringify(data)};</script>`;
    expect(parseYoutubeResults(html).map((v) => v.videoId)).toEqual(['abc']);
    const now = new Date('2026-10-01T12:00:00Z');
    expect(parseRelativeAgo('10 hours ago', now)!.toISOString()).toBe('2026-10-01T02:00:00.000Z');
    expect(parseRelativeAgo('Streamed 2 days ago', now)!.toISOString()).toBe('2026-09-29T12:00:00.000Z');
    expect(parseRelativeAgo('3y ago', now)!.getUTCFullYear()).toBe(2023);
    expect(parseRelativeAgo('5mo ago', now)!.toISOString().slice(0, 7)).toBe('2026-05');
    expect(parseRelativeAgo('10h ago', now)!.toISOString()).toBe('2026-10-01T02:00:00.000Z');
    expect(parseRelativeAgo('45m ago', now)!.toISOString()).toBe('2026-10-01T11:15:00.000Z');
    expect(parseRelativeAgo('2w ago', now)!.toISOString().slice(0, 10)).toBe('2026-09-17');
    expect(parseRelativeAgo(undefined, now)).toBeNull();
    expect(parseRelativeAgo('Premieres tomorrow', now)).toBeNull();
  });
});

describe('youtube search listing filter', () => {
  it('drops property ads, keeps news', async () => {
    const { LISTING } = await import('./collectors/collectors');
    for (const t of ['190,000$-MIRZO-ULUG’BEK TUMANI', 'New Cottages for Sale in Mirzo Ulugbek District', 'REFAR | Kvartira | Toshkent |ID 5507 Mirzo Ulug’bek', '3-xonali uy sotiladi Mirzo Ulug‘bek'])
      expect(LISTING.test(t)).toBe(true);
    for (const t of ['Mirzo Ulug‘bekda odamlar o‘z uyiga erkin kirolmay qoldi', '"BAMASLAHAT". Mirzo Ulug‘bek tumani, "Zakovat" mahallasi'])
      expect(LISTING.test(t)).toBe(false);
  });
});

describe('channel signatures are not mentions', () => {
  it('ignores @handles and t.me links when matching the district', () => {
    const m1 = match('Октябрь ойида кутилаётган об-ҳаво эълон қилинди', 'Батафсил 👉 @MIRZO_ULUGBEK');
    expect(m1.strong).toEqual([]);
    expect(m1.weak).toEqual([]);
    expect(match('Yangilik', 'Kanalga obuna: https://t.me/mirzo_ulugbek').weak).toEqual([]);
    // a real mention next to the signature still counts
    expect(match("Mirzo Ulug‘bek tumanida yo'l ta'mirlandi", 'Батафсил 👉 @MIRZO_ULUGBEK').strong.length).toBeGreaterThan(0);
  });
});
