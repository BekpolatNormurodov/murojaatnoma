import { create } from "zustand";
import { persist } from "zustand/middleware";
import { API_BASE } from "@/shared/api/config";

/** Backend admin roli (auth/admin/login + /auth/admin/me bilan bir xil). */
export type AdminRole = "SUPER_ADMIN" | "ADMIN" | "VIEWER";

export interface AuthUser {
  /** Admin akkaunt id'si (AdminDto.id bilan bir xil) — o'zini solishtirish uchun
   *  (masalan Adminlar sahifasida: o'z qatoringni o'zgartira olmaslik). */
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatar?: string;
  username?: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

interface AdminDto {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  admin: AdminDto;
}

interface AuthState {
  isAuthed: boolean;
  user: AuthUser | null;
  /** Access token (real JWT from the backend admin-auth service). */
  token: string | null;
  refreshToken: string | null;
  /** Real login: POST /auth/admin/login (username + password). */
  login: (username: string, password: string) => Promise<AuthResult>;
  /**
   * Silent access-token rotation via the refresh token.
   * 'rejected' = the server refused it (session really over);
   * 'network'  = couldn't reach the server — the session is still valid.
   */
  refresh: () => Promise<RefreshResult>;
  logout: () => void;
}

function toUser(a: AdminDto): AuthUser {
  return {
    id: a.id,
    name: a.fullName || a.username,
    email: a.email ?? "",
    role: a.role as AdminRole,
    username: a.username,
  };
}

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

function messageOf(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message: unknown }).message;
    if (Array.isArray(m)) return m.join(", ");
    if (typeof m === "string") return m;
  }
  return fallback;
}

export type RefreshResult = 'ok' | 'rejected' | 'network';

// Shared in-flight refresh so concurrent 401s trigger only one refresh call.
let refreshInFlight: Promise<RefreshResult> | null = null;

function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthed: false,
      user: null,
      token: null,
      refreshToken: null,

      login: async (username, password) => {
        try {
          const res = await fetch(`${API_BASE}/auth/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username.trim(), password }),
          });
          const data = await readJson(res);
          if (!res.ok) {
            return { ok: false, error: messageOf(data, "Login yoki parol xato") };
          }
          const d = data as LoginResponse;
          set({
            isAuthed: true,
            user: toUser(d.admin),
            token: d.accessToken,
            refreshToken: d.refreshToken,
          });
          return { ok: true };
        } catch {
          return { ok: false, error: "Serverga ulanib bo'lmadi" };
        }
      },

      refresh: () => {
        const rt = get().refreshToken;
        if (!rt) return Promise.resolve<RefreshResult>('rejected');
        if (refreshInFlight) return refreshInFlight;

        refreshInFlight = (async (): Promise<RefreshResult> => {
          // Same key on every attempt: if the server rotated the token but the
          // response was lost, the retry replays the SAME new pair (the old
          // token is already revoked) instead of logging the admin out.
          const key = newIdempotencyKey();
          try {
            for (let attempt = 0; attempt < 3; attempt++) {
              let res: Response;
              try {
                res = await fetch(`${API_BASE}/auth/admin/refresh`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
                  body: JSON.stringify({ refreshToken: rt }),
                });
              } catch {
                await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
                continue; // network error — retry
              }
              if (res.status >= 500) {
                await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
                continue;
              }
              if (!res.ok) {
                set({ isAuthed: false, user: null, token: null, refreshToken: null });
                return 'rejected';
              }
              const d = (await res.json()) as LoginResponse;
              set({
                isAuthed: true,
                user: toUser(d.admin),
                token: d.accessToken,
                refreshToken: d.refreshToken,
              });
              return 'ok';
            }
            return 'network';
          } finally {
            refreshInFlight = null;
          }
        })();
        return refreshInFlight;
      },

      logout: () => {
        // Revoke the refresh token server-side (it stayed valid for 30 days).
        // keepalive: survives the hard redirect to /login that follows.
        const rt = get().refreshToken;
        if (rt) {
          void fetch(`${API_BASE}/auth/admin/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: rt }),
            keepalive: true,
          }).catch(() => undefined);
        }
        set({ isAuthed: false, user: null, token: null, refreshToken: null });
      },
    }),
    {
      name: "hokimiyat-auth",
      partialize: (s) => ({
        isAuthed: s.isAuthed,
        user: s.user,
        token: s.token,
        refreshToken: s.refreshToken,
      }),
    },
  ),
);
