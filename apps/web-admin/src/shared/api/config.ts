/**
 * Base URL for the backend API.
 *
 * In production the web-admin is served behind the same nginx gateway as the
 * backend, so the same-origin `/api` prefix reaches `backend:3000` (the gateway
 * strips `/api`). For local dev against a remote backend, set `VITE_API_URL`
 * (e.g. `https://murojaatnoma.uz/api`).
 */
const raw = (import.meta.env as Record<string, string | undefined>).VITE_API_URL;

export const API_BASE = (raw && raw.length > 0 ? raw : '/api').replace(/\/$/, '');
