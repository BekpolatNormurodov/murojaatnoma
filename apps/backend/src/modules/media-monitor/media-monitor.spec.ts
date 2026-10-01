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
