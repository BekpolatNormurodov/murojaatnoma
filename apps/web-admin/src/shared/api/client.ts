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

function parseError(status: number, data: unknown): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(', ');
    if (typeof m === 'string') return m;
  }
  return `Xatolik (${status})`;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  allowRetry = true,
): Promise<T> {
  const { token } = useAuth.getState();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: string | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });

  // Access token expired: try a single silent refresh, then replay once.
  if (res.status === 401 && allowRetry) {
    const refreshed = await useAuth.getState().refresh();
    if (refreshed) return request<T>(method, path, body, false);
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
  const { token } = useAuth.getState();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });

  if (res.status === 401 && allowRetry) {
    const refreshed = await useAuth.getState().refresh();
    if (refreshed) return uploadRequest<T>(path, formData, false);
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
