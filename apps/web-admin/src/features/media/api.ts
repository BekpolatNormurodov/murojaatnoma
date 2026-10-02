import { useEffect } from 'react';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { useRealtime } from '@/shared/realtime/RealtimeProvider';

/**
 * OAV monitoringi — backend: apps/backend/src/modules/media-monitor.
 * The server collects every 15 min; the page polls lightly as a fallback and
 * refreshes instantly on the `media:update` socket event.
 */

export type MediaPlatform = 'web' | 'telegram' | 'youtube' | 'instagram';
export type MediaSentiment = 'positive' | 'neutral' | 'negative';
export type MediaStatus = 'new' | 'seen' | 'important' | 'hidden';
export type MediaPeriod = '24h' | '7d' | '30d' | 'all';
/** district = Mirzo Ulug'bek tumani (default), city = Toshkent shahri (incl. the district), region = Toshkent viloyati. */
export type MediaArea = 'district' | 'city' | 'region';

export interface MediaItem {
  id: string;
  source: string;
  sourceName: string;
  platform: MediaPlatform;
  url: string;
  title: string;
  excerpt: string | null;
  imageUrl: string | null;
  author: string | null;
  views: number | null;
  publishedAt: string;
  keywords: string[];
  relevance: number;
  /** 0..100 per wider area (see MediaArea). */
  cityRelevance?: number;
  regionRelevance?: number;
  sentiment: MediaSentiment;
  topic: string | null;
  aiSummary: string | null;
  analyzedBy: 'ai' | 'rules' | null;
  status: MediaStatus;
  /** Published by a state body (gov.uz, President's press office, UzA, parliament, hokimlik). */
  official: boolean;
  storyId?: string | null;
  /** Other outlets that carried the same story (grouped feed). */
  alsoIn?: StoryRef[];
  storySize?: number;
}

export interface StoryRef {
  id: string;
  sourceName: string;
  url: string;
  platform: MediaPlatform;
  official: boolean;
  publishedAt: string;
}

export interface MediaDigest {
  id: string;
  createdAt: string;
  periodFrom: string;
  periodTo: string;
  itemCount: number;
  positive: number;
  neutral: number;
  negative: number;
  headline: string;
  summary: string;
  topics: { name: string; count: number; sentiment: MediaSentiment }[];
  risks: { title: string; detail: string; level: 'high' | 'medium' | 'low'; itemIds: string[] }[];
  recommendations: string[];
  model: string;
}

export interface MediaSourceHealth {
  key: string;
  name: string;
  platform: MediaPlatform;
  ok: boolean | null;
  error?: string;
  skipped?: string;
  fetched: number;
  matched: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
}

export interface MediaStatusInfo {
  enabled: boolean;
  running: boolean;
  lastRun: {
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    newItems: number;
    negativeNew: number;
    digest: boolean;
    aiError?: string;
  } | null;
  nextRunAt: string | null;
  /** enabled = key configured AND switch on. */
  ai: { enabled: boolean; keyConfigured: boolean; switchOn: boolean; model: string | null; lastError: string | null };
  integrations: { youtube: boolean; instagram: boolean };
  sources: MediaSourceHealth[];
}

export interface MediaOverview {
  period: MediaPeriod;
  area: MediaArea;
  minRelevance: number;
  totals: {
    all: number;
    /** Distinct events (a story told by 3 outlets counts once). */
    stories: number;
    positive: number;
    neutral: number;
    negative: number;
    important: number;
    unseen: number;
    official: number;
    previous: number;
  };
  platforms: Record<MediaPlatform, number>;
  sources: { source: string; sourceName: string; platform: MediaPlatform; count: number; negative: number }[];
  topics: { topic: string; count: number; negative: number; positive: number }[];
  timeline: {
    unit: 'hour' | 'day';
    points: { t: string; positive: number; neutral: number; negative: number }[];
  };
  digest: MediaDigest | null;
  /** Original posts behind digest.risks[].itemIds. */
  digestRefs: { id: string; url: string; title: string; sourceName: string; platform: MediaPlatform; publishedAt: string }[];
  alerts: MediaItem[];
  latest: MediaItem[];
  /** Most-viewed items of the period (Telegram / YouTube view counts). */
  topViewed: MediaItem[];
  status: MediaStatusInfo;
}

export interface MediaFilters {
  period: MediaPeriod;
  area?: MediaArea;
  platform?: MediaPlatform;
  sentiment?: MediaSentiment;
  status?: MediaStatus;
  topic?: string;
  source?: string;
  q?: string;
  /** official = state bodies, media = news outlets. */
  kind?: 'official' | 'media';
  /** 0 ⇒ also weakly-related items. */
  minRelevance?: number;
}

export interface MediaFeedConfig {
  key: string;
  name: string;
  url: string;
  enabled: boolean;
  official?: boolean;
}

export interface GovAuthority {
  slug: string;
  name: string;
  /** The district's own hokimligi — every post counts. */
  own: boolean;
  /** City / region hokimligi — every post counts for that area. */
  area?: 'city' | 'region';
}

export interface MediaSettings {
  keywords: string[];
  weakKeywords: string[];
  excludes: string[];
  placeKeywords: string[];
  rssFeeds: MediaFeedConfig[];
  telegramChannels: string[];
  officialTelegramChannels: string[];
  localTelegramChannels: string[];
  cityTelegramChannels: string[];
  regionTelegramChannels: string[];
  telegramSearchQueries: string[];
  youtubeSearchQueries: string[];
  officialYoutubeChannels: string[];
  ownYoutubeChannels: string[];
  govAuthorities: GovAuthority[];
  googleNewsSites: string[];
  youtubeChannels: string[];
  youtubeQuery: string;
  instagramHashtags: string[];
  instagramAccounts: string[];
  officialInstagramAccounts: string[];
  ownInstagramAccounts: string[];
  cityInstagramAccounts: string[];
  regionInstagramAccounts: string[];
  googleNewsQuery: string;
  minRelevance: number;
  /** "AI tahlil" switch (needs ANTHROPIC_API_KEY on the server). */
  aiEnabled: boolean;
  /** Server-managed default-source version (sent back unchanged). */
  sourcesVersion?: number;
}

export interface MediaSettingsView {
  settings: MediaSettings;
  defaults: MediaSettings;
  integrations: { ai: boolean; aiModel: string | null; youtube: boolean; instagram: boolean };
}

const PAGE = 20;
const FALLBACK_POLL_MS = 5 * 60_000;

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useMediaOverview(period: MediaPeriod = '7d', area: MediaArea = 'district') {
  return useQuery({
    queryKey: ['media', 'overview', period, area],
    queryFn: () => api.get<MediaOverview>(`/media/overview${qs({ period, area: area === 'district' ? undefined : area })}`),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    // While a run is in progress, follow it closely; otherwise a slow fallback poll.
    refetchInterval: (q) => (q.state.data?.status.running ? 3_000 : FALLBACK_POLL_MS),
  });
}

export function useMediaItems(f: MediaFilters) {
  return useInfiniteQuery({
    queryKey: ['media', 'items', f],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      api.get<{ items: MediaItem[]; total: number; page: number; limit: number; grouped?: boolean }>(
        `/media/items${qs({ ...f, area: f.area === 'district' ? undefined : f.area, page: pageParam, limit: PAGE })}`,
      ),
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
    refetchInterval: FALLBACK_POLL_MS,
  });
}

/** Per-source health of the last run (settings modal → Holat). */
export function useMediaStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['media', 'status'],
    queryFn: () => api.get<MediaStatusInfo>('/media/status'),
    enabled,
    refetchInterval: (q) => (q.state.data?.running ? 3_000 : 30_000),
  });
}

export function useMediaDigests(enabled: boolean) {
  return useQuery({
    queryKey: ['media', 'digests'],
    queryFn: () => api.get<MediaDigest[]>('/media/digests?limit=12'),
    enabled,
    staleTime: 60_000,
  });
}

export function useRefreshMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ started: boolean; running: boolean; retryAfterSec?: number }>('/media/refresh'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media', 'overview'] }),
  });
}

export function useRegenerateDigest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<MediaDigest>('/media/digest'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  });
}

export function useUpdateMediaItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: MediaStatus; sentiment?: MediaSentiment }) =>
      api.patch<MediaItem>(`/media/items/${id}`, body),
    // Patch the item in every cached feed page right away; counters follow on refetch.
    onSuccess: (updated) => {
      qc.setQueriesData<{ pages: { items: MediaItem[] }[] }>({ queryKey: ['media', 'items'] }, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((p) => ({
                ...p,
                items: p.items.map((i) => (i.id === updated.id ? updated : i)),
              })),
            }
          : old,
      );
      void qc.invalidateQueries({ queryKey: ['media', 'overview'] });
    },
  });
}

export function useMarkAllSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ updated: number }>('/media/items/mark-seen', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  });
}

export function useMediaSettings(enabled = true) {
  return useQuery({
    queryKey: ['media', 'settings'],
    queryFn: () => api.get<MediaSettingsView>('/media/settings'),
    enabled,
    staleTime: 60_000,
  });
}

export function useSaveMediaSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Partial<MediaSettings>) => api.put<MediaSettingsView>('/media/settings', s),
    onSuccess: (view) => {
      qc.setQueryData(['media', 'settings'], view);
      void qc.invalidateQueries({ queryKey: ['media', 'overview'] });
      void qc.invalidateQueries({ queryKey: ['media', 'items'] });
    },
  });
}

/** Live refresh: the backend emits `media:update` after a run that found something. */
export function useMediaLive(onUpdate?: (e: { newItems: number; negativeNew: number }) => void) {
  const { socket } = useRealtime();
  const qc = useQueryClient();
  useEffect(() => {
    if (!socket) return;
    const handler = (e: { newItems: number; negativeNew: number }) => {
      void qc.invalidateQueries({ queryKey: ['media'] });
      onUpdate?.(e);
    };
    socket.on('media:update', handler);
    return () => {
      socket.off('media:update', handler);
    };
  }, [socket, qc, onUpdate]);
}
