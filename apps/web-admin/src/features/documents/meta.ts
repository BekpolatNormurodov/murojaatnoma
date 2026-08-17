import {
  DocumentText,
  ClipboardText,
  ReceiptText,
  Note1,
  Judge,
  TaskSquare,
  type Icon as IconType,
} from "iconsax-react";
import type {
  GovDocStatus,
  GovDocType,
  GovDocument,
} from "@/shared/data/types";
import { formatDate } from "@/shared/lib/format";
import type { ExportColumn } from "@/shared/lib/export";

export const TYPE_META: Record<
  GovDocType,
  { label: string; icon: IconType; color: string }
> = {
  qaror: { label: "Qaror", icon: Judge, color: "#10b981" },
  buyruq: { label: "Buyruq", icon: ClipboardText, color: "#6366f1" },
  hisobot: { label: "Hisobot", icon: ReceiptText, color: "#06b6d4" },
  shartnoma: { label: "Shartnoma", icon: TaskSquare, color: "#f59e0b" },
  ariza: { label: "Ariza", icon: Note1, color: "#a855f7" },
  dalolatnoma: { label: "Dalolatnoma", icon: DocumentText, color: "#ef4444" },
};

export const STATUS_META: Record<
  GovDocStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning" }
> = {
  draft: { label: "Qoralama", tone: "neutral" },
  review: { label: "Ko'rib chiqilmoqda", tone: "warning" },
  signed: { label: "Imzolangan", tone: "success" },
  archived: { label: "Arxiv", tone: "info" },
};

/** Holat rangi — Select nuqtalari uchun. */
export const STATUS_DOT: Record<GovDocStatus, string> = {
  draft: "#94a3b8",
  review: "#f59e0b",
  signed: "#10b981",
  archived: "#3b82f6",
};

/** Holat bosqichlari tartibi — timeline uchun. */
export const STATUS_FLOW: { key: GovDocStatus; label: string; hint: string }[] =
  [
    {
      key: "draft",
      label: "Yaratildi",
      hint: "Hujjat qoralama sifatida shakllantirildi",
    },
    {
      key: "review",
      label: "Ko'rib chiqildi",
      hint: "Mas'ul bo'lim ko'rigidan o'tdi",
    },
    { key: "signed", label: "Imzolandi", hint: "Rahbar tomonidan tasdiqlandi" },
    {
      key: "archived",
      label: "Arxivlandi",
      hint: "Ijro yakunlanib, arxivga topshirildi",
    },
  ];

/** Holatning bosqich indeksi (0..3). */
export function statusStep(status: GovDocStatus): number {
  const i = STATUS_FLOW.findIndex((s) => s.key === status);
  return i < 0 ? 0 : i;
}

/** Hujjat kodidan deterministik ro'yxat raqami. */
export function docRegNo(doc: GovDocument): string {
  const digits = doc.code.replace(/\D/g, "").slice(-4).padStart(4, "0");
  return `№ ${doc.type.slice(0, 2).toUpperCase()}-${digits}`;
}

export function formatSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

/** Tur bo'yicha hujjat kirish qismi (preambula). */
const TYPE_PREAMBLE: Record<GovDocType, string> = {
  qaror:
    "Tumanni ijtimoiy-iqtisodiy rivojlantirish vazifalarini hal etish maqsadida va amaldagi qonunchilikka muvofiq, tuman hokimi QAROR QILADI:",
  buyruq:
    "Tashkiliy ishlarni tartibga solish hamda ijro intizomini ta'minlash yuzasidan BUYURAMAN:",
  hisobot:
    "Hisobot davrida bajarilgan ishlar, erishilgan natijalar va moliyaviy ko'rsatkichlar quyida tahlil qilingan holda keltirilgan:",
  shartnoma:
    "Tomonlar o'zaro kelishuv asosida quyidagi shartlar bo'yicha ushbu shartnomani tuzdilar:",
  ariza:
    "Quyidagi masala yuzasidan ko'rib chiqishingizni va tegishli chora ko'rishingizni so'rayman:",
  dalolatnoma:
    "Komissiya tomonidan o'tkazilgan tekshiruv natijasida quyidagilar aniqlandi va ushbu dalolatnoma tuzildi:",
};

/** Tur bo'yicha asosiy bandlar [mazmun, mas'ul]. */
const TYPE_CLAUSES: Record<GovDocType, [string, string][]> = {
  qaror: [
    ["Belgilangan vazifalar ijrosini ta'minlash", "Hokim o'rinbosari"],
    ["Zarur moliyaviy mablag'larni ajratish", "Moliya bo'limi"],
    ["Ijro muddatlari ustidan nazorat o'rnatish", "Kotibiyat"],
    ["Aholini o'rnatilgan tartibda xabardor qilish", "Axborot xizmati"],
  ],
  buyruq: [
    ["Topshiriqlar ro'yxatini tasdiqlash", "Bo'lim boshlig'i"],
    ["Mas'ul xodimlarni belgilash", "Kadrlar bo'limi"],
    ["Bajarilish muddatini belgilash", "Kotibiyat"],
  ],
  hisobot: [
    ["Rejalashtirilgan ko'rsatkichlar bajarilishi", "Tahlil bo'limi"],
    ["Moliyaviy mablag'lar sarfi", "Moliya bo'limi"],
    ["Aniqlangan kamchiliklar va takliflar", "Monitoring markazi"],
  ],
  shartnoma: [
    ["Shartnoma predmeti va hajmi", "Buyurtmachi"],
    ["Tomonlar majburiyatlari", "Ijrochi"],
    ["To'lov tartibi va muddatlari", "Moliya bo'limi"],
    ["Nizolarni hal etish tartibi", "Yuridik bo'lim"],
  ],
  ariza: [
    ["Murojaat mohiyati va asoslari", "Ariza beruvchi"],
    ["Talab qilinayotgan chora", "Mas'ul bo'lim"],
  ],
  dalolatnoma: [
    ["Tekshiruv predmeti va sanasi", "Komissiya raisi"],
    ["Aniqlangan holatlar bayoni", "Komissiya a'zolari"],
    ["Xulosa va tavsiyalar", "Komissiya raisi"],
  ],
};

/** Excel/CSV eksport ustunlari. */
export const DOC_EXPORT_COLUMNS: ExportColumn<GovDocument>[] = [
  { header: "Kod", value: (d) => d.code },
  { header: "Nomi", value: (d) => d.title },
  { header: "Turi", value: (d) => TYPE_META[d.type].label },
  { header: "Holati", value: (d) => STATUS_META[d.status].label },
  { header: "Muallif", value: (d) => d.author },
  { header: "Hudud", value: (d) => d.region },
  { header: "Sana", value: (d) => formatDate(d.createdAt) },
  {
    header: "Hajmi (KB)",
    value: (d) => d.sizeKb,
    align: "right",
    total: (rows) => rows.reduce((s, d) => s + d.sizeKb, 0),
  },
  {
    header: "Betlar",
    value: (d) => d.pages,
    align: "right",
    total: (rows) => rows.reduce((s, d) => s + d.pages, 0),
  },
];

/** Bitta hujjatning chop etish / yuklab olish uchun HTML ko'rinishi. */
export function buildDocHTML(doc: GovDocument): string {
  const t = TYPE_META[doc.type];
  const s = STATUS_META[doc.status];
  const draftBanner =
    doc.status === "draft"
      ? `<div class="draft-banner">QORALAMA — hujjat rasmiy kuchga ega emas</div>`
      : "";
  const clauses = TYPE_CLAUSES[doc.type]
    .map(
      ([text, owner], i) =>
        `<tr><td style="width:42px;text-align:center">${i + 1}</td><td>${text}</td><td>${owner}</td></tr>`,
    )
    .join("");
  return `
  ${draftBanner}
  <div class="doc-head">
    <div class="doc-seal">H</div>
    <div>
      <div class="doc-org">O'zbekiston Respublikasi · Tuman Hokimligi</div>
      <div class="doc-sub">Raqamli boshqaruv tizimi · rasmiy hujjat</div>
    </div>
  </div>
  <div class="reg">
    <span>Ro'yxat raqami: <b>${docRegNo(doc)}</b></span>
    <span>Sana: <b>${formatDate(doc.createdAt)}</b></span>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div class="muted">${t.label} · ${doc.code}</div>
      <h1>${doc.title}</h1>
    </div>
    <span class="badge">${s.label}</span>
  </div>
  <div class="legal">
    Huquqiy asos: O'zbekiston Respublikasining "Mahalliy davlat hokimiyati to'g'risida"gi
    qonuni hamda tuman hokimligi nizomiga muvofiq qabul qilindi.
  </div>
  <div class="meta-grid">
    <div><b>Muallif:</b> ${doc.author}</div>
    <div><b>Hudud:</b> ${doc.region}</div>
    <div><b>Hujjat turi:</b> ${t.label}</div>
    <div><b>Hajmi:</b> ${formatSize(doc.sizeKb)} · ${doc.pages} bet</div>
  </div>
  <p class="preamble">${TYPE_PREAMBLE[doc.type]}</p>
  <table>
    <tr><th style="width:42px;text-align:center">№</th><th>Band mazmuni</th><th style="width:170px">Mas'ul</th></tr>
    ${clauses}
  </table>
  <p class="muted" style="margin-top:16px;line-height:1.7">
    Ushbu hujjat Tuman Hokimligi raqamli boshqaruv tizimi orqali shakllantirildi.
    Hujjat ${doc.pages} betdan iborat bo'lib, "${s.label}" holatida saqlanmoqda.
  </p>
  <div class="sign-grid">
    <div class="sign-box"><div class="sign-line">Tuman hokimi</div></div>
    <div class="sign-box"><div class="sign-line">${doc.author}</div></div>
    <div class="qr">QR-kod<br/>${doc.code}</div>
  </div>
  <div class="foot">
    <span class="muted">Hujjat kodi: ${doc.code}</span>
    <span class="muted">Chop etilgan: ${new Date().toLocaleString("uz-UZ")}</span>
  </div>`;
}
