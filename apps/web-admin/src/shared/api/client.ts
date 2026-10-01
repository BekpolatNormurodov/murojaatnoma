import { useAuth } from '@/shared/store/auth';
import { API_BASE } from './config';

/** Error thrown for non-2xx API responses. */
export class ApiError extends Error {
  status: number;
  data?: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/** NestJS default (English) messages → what an operator should read. */
const DEFAULT_MESSAGES: Record<string, string> = {
  'Forbidden resource': "Bu amal uchun ruxsatingiz yo'q (faqat bosh administrator)",
  Forbidden: "Bu amal uchun ruxsatingiz yo'q",
  Unauthorized: 'Sessiya tugadi — qayta kiring',
  'Internal server error': "Serverda xatolik yuz berdi — birozdan so'ng qayta urinib ko'ring",
  'Too Many Requests': "Juda ko'p so'rov — bir oz kuting",
};

function parseError(status: number, data: unknown): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message: unknown }).message;
    if (Array.isArray(m)) return m.map((x) => DEFAULT_MESSAGES[String(x)] ?? String(x)).join('; ');
    if (typeof m === 'string') return DEFAULT_MESSAGES[m] ?? m;
  }
  if (status === 403) return DEFAULT_MESSAGES.Forbidden;
  if (status >= 500) return DEFAULT_MESSAGES['Internal server error'];
  return `Xatolik (${status})`;
}

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Seconds until the access token's `exp` (Infinity if unknown). */
function secondsLeft(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      exp?: number;
    };
    return payload.exp ? payload.exp - Date.now() / 1000 : Infinity;
  } catch {
    return Infinity;
  }
}

/**
 * Refresh BEFORE the access token expires (≤30 s left) instead of letting the
 * request fail with 401 first — saves a round-trip on slow links and keeps the
 * console free of 401 noise after the tab was idle.
 */
async function refreshIfExpiring(): Promise<void> {
  const { token, refreshToken } = useAuth.getState();
  if (token && refreshToken && secondsLeft(token) < 30) {
    await useAuth.getState().refresh();
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  allowRetry = true,
  idempotencyKey: string = newKey(),
): Promise<T> {
  await refreshIfExpiring();
  const { token } = useAuth.getState();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  // Writes carry an Idempotency-Key: a double-click / replay after a dropped
  // connection is executed once by the backend.
  if (method !== 'GET') headers['Idempotency-Key'] = idempotencyKey;

  let payload: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Internetga ulanib bo'lmadi — aloqani tekshirib, qayta urining");
  }

  // Access token expired: try a single silent refresh, then replay once.
  if (res.status === 401 && allowRetry) {
    const refreshed = await useAuth.getState().refresh();
    if (refreshed === 'ok') return request<T>(method, path, body, false, idempotencyKey);
    if (refreshed === 'network') {
      // Session is still valid — don't log out on a network blip.
      throw new ApiError(0, "Internetga ulanib bo'lmadi — aloqani tekshirib, qayta urining");
    }
    useAuth.getState().logout();
    throw new ApiError(401, 'Sessiya tugadi, qayta kiring');
  }

  const text = await res.text();
  const data: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, parseError(res.status, data), data);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * multipart/form-data upload (e.g. POST /uploads for chat voice/image/file).
 * Deliberately does NOT set Content-Type — the browser must set the multipart
 * boundary itself. Mirrors {@link request}'s single silent-refresh-on-401 retry.
 */
async function uploadRequest<T>(path: string, formData: FormData, allowRetry = true): Promise<T> {
  await refreshIfExpiring();
  const { token } = useAuth.getState();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });
  } catch {
    throw new ApiError(0, "Internetga ulanib bo'lmadi — aloqani tekshirib, qayta urining");
  }

  if (res.status === 401 && allowRetry) {
    const refreshed = await useAuth.getState().refresh();
    if (refreshed === 'ok') return uploadRequest<T>(path, formData, false);
    if (refreshed === 'network') {
      throw new ApiError(0, "Internetga ulanib bo'lmadi — aloqani tekshirib, qayta urining");
    }
    useAuth.getState().logout();
    throw new ApiError(401, 'Sessiya tugadi, qayta kiring');
  }

  const text = await res.text();
  const data: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, parseError(res.status, data), data);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, formData: FormData) => uploadRequest<T>(path, formData),
};
