import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

/** Soxta (demo) login ma'lumotlari — backend yo'q, faqat namoyish uchun. */
export const DEMO_CREDENTIALS = {
  email: "admin@hokimiyat.uz",
  password: "123456",
};

export interface AuthResult {
  ok: boolean;
  error?: string;
}

interface AuthState {
  isAuthed: boolean;
  user: AuthUser | null;
  /** Soxta JWT-ko'rinishidagi token (demo). */
  token: string | null;
  /** Email + parolni tekshirib, muvaffaqiyatli bo'lsa soxta token beradi. */
  login: (email: string, password: string) => AuthResult;
  logout: () => void;
}

const DEFAULT_USER: AuthUser = {
  name: "Admin Hokim",
  email: "admin@hokimiyat.uz",
  role: "Bosh administrator",
  avatar: "https://randomuser.me/api/portraits/men/32.jpg",
};

/** base64url — JWT segmentlari uchun (oaddiy, brauzerda ishlaydigan). */
function b64url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Soxta JWT yasaydi (header.payload.signature). Imzo HAQIQIY emas — demo uchun
 * tasodifiy qiymat. Backend ulanganda bu butunlay almashtiriladi.
 */
function makeFakeToken(user: AuthUser): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(
    JSON.stringify({
      sub: user.email,
      name: user.name,
      role: user.role,
      iat: now,
      exp: now + 60 * 60 * 24, // 24 soat
    }),
  );
  const signature = b64url(`${Math.random().toString(36).slice(2)}${now}`);
  return `${header}.${payload}.${signature}`;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      isAuthed: false,
      user: null,
      token: null,
      login: (email, password) => {
        const e = email.trim().toLowerCase();
        if (
          e !== DEMO_CREDENTIALS.email ||
          password !== DEMO_CREDENTIALS.password
        ) {
          return { ok: false, error: "Email yoki parol noto'g'ri" };
        }
        const user: AuthUser = {
          ...DEFAULT_USER,
          email: DEMO_CREDENTIALS.email,
        };
        set({ isAuthed: true, user, token: makeFakeToken(user) });
        return { ok: true };
      },
      logout: () => set({ isAuthed: false, user: null, token: null }),
    }),
    { name: "hokimiyat-auth" },
  ),
);
