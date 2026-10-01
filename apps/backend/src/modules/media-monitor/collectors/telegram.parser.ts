import { decodeEntities, htmlToText, parseCompactNumber, parseFeedDate, truncate } from '../media-text.util';
import { RawMediaItem } from './collector.types';

/**
 * Parses the public channel preview page `https://t.me/s/<channel>` (no bot
 * token, no login): the last ~20 posts with text, time, photo and views.
 */
export function parseTelegramPreview(html: string, channel: string, now = new Date()): RawMediaItem[] {
  const channelTitle =
    decodeEntities(/<meta property="og:title" content="([^"]*)"/.exec(html)?.[1] ?? '').trim() || `@${channel}`;
  const chunks = html.split(/<div class="tgme_widget_message_wrap/).slice(1);
  const out: RawMediaItem[] = [];
  for (const c of chunks) {
    const post = /data-post="([^"]+)"/.exec(c)?.[1];
    if (!post) continue;
    const textHtml = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(c)?.[1];
    if (!textHtml) continue; // media-only / service post — nothing to match on
    const text = htmlToText(textHtml);
    if (!text) continue;
    const firstLine = text.split('\n').find((l) => l.trim().length > 0) ?? text;
    const title = truncate(firstLine.trim(), 160);
    const rest = text.slice(text.indexOf(firstLine) + firstLine.length).trim();
    const image =
      /tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/.exec(c)?.[1] ??
      /tgme_widget_message_video_thumb[^>]*background-image:url\('([^']+)'\)/.exec(c)?.[1] ??
      /link_preview_image[^>]*background-image:url\('([^']+)'\)/.exec(c)?.[1];
    const views = parseCompactNumber(/<span class="tgme_widget_message_views">([^<]+)<\/span>/.exec(c)?.[1]);
    const datetime = /<time[^>]*datetime="([^"]+)"/.exec(c)?.[1];
    out.push({
      source: `tg:${channel.toLowerCase()}`,
      sourceName: channelTitle,
      platform: 'telegram',
      externalId: post,
      url: `https://t.me/${post}`,
      title,
      text: rest || text,
      imageUrl: image,
      author: channelTitle,
      views,
      publishedAt: parseFeedDate(datetime, now),
    });
  }
  return out;
}
