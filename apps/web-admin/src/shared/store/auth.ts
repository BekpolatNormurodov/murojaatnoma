import { create } from "zustand";
import { persist } from "zustand/middleware";
import { API_BASE } from "@/shared/api/config";

export interface AuthUser {
  name: string;
  email: string;
  role: string;
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
  /** Silent access-token rotation via the refresh token. */
  refresh: () => Promise<boolean>;
  logout: () => void;
}

function toUser(a: AdminDto): AuthUser {
  return {
    name: a.fullName || a.username,
    email: a.email ?? "",
    role: a.role,
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

// Shared in-flight refresh so concurrent 401s trigger only one refresh call.
let refreshInFlight: Promise<boolean> | null = null;

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
        if (!rt) return Promise.resolve(false);
        if (refreshInFlight) return refreshInFlight;

        refreshInFlight = (async () => {
          try {
            const res = await fetch(`${API_BASE}/auth/admin/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken: rt }),
            });
            if (!res.ok) {
              set({ isAuthed: false, user: null, token: null, refreshToken: null });
              return false;
            }
            const d = (await res.json()) as LoginResponse;
            set({
              isAuthed: true,
              user: toUser(d.admin),
              token: d.accessToken,
              refreshToken: d.refreshToken,
            });
            return true;
          } catch {
            return false;
          } finally {
            refreshInFlight = null;
          }
        })();
        return refreshInFlight;
      },

      logout: () =>
        set({ isAuthed: false, user: null, token: null, refreshToken: null }),
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
