/* ============================================================
   Eksport / chop etish / yuklab olish yordamchilari
   Excel — SheetJS (real .xlsx: Numbers ham, Excel ham to'g'ri ochadi).
   ============================================================ */
import * as XLSX from 'xlsx';

/** Faylni brauzer orqali yuklab olish (Blob). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Matnli faylni yuklab olish. */
export function downloadText(
  text: string,
  filename: string,
  mime = "text/plain;charset=utf-8",
) {
  downloadBlob(new Blob(["\uFEFF" + text], { type: mime }), filename);
}

function escapeCsv(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Fayl nomi uchun vaqt belgisi: 2026-06-12_14-30 */
export function fileStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`;
}

/** Matnni clipboard'ga nusxalash (xatoga chidamli). */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Massiv yoki obyektni JSON fayl sifatida yuklab olish. */
export function exportToJSON<T>(filename: string, data: T) {
  downloadText(
    JSON.stringify(data, null, 2),
    filename.endsWith(".json") ? filename : `${filename}.json`,
    "application/json;charset=utf-8",
  );
}

export interface ExportColumn<T> {
  header: string;
  /** Qatordan qiymatni ajratib olish. */
  value: (row: T) => string | number;
  /** Matn joylashuvi (Excel/print). */
  align?: "left" | "center" | "right";
  /** Jami qatori uchun yig'indi (Excel pastki qatori). */
  total?: (rows: T[]) => string | number;
}

/** Massivni CSV (Excel ochadi) sifatida yuklab olish. UTF-8 BOM bilan. */
export function exportToCSV<T>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
) {
  const head = columns.map((c) => escapeCsv(c.header)).join(",");
  const body = rows
    .map((r) => columns.map((c) => escapeCsv(c.value(r))).join(","))
    .join("\n");
  downloadText(
    `${head}\n${body}`,
    filename.endsWith(".csv") ? filename : `${filename}.csv`,
    "text/csv;charset=utf-8",
  );
}

export interface SheetSpec<T> {
  /** Sheet (tab) nomi — Excel 31 belgigacha ruxsat beradi. */
  name: string;
  columns: ExportColumn<T>[];
  rows: T[];
  opts?: { title?: string; subtitle?: string };
}

/** Ustunlar + qatorlardan SheetJS worksheet (sarlavha + jami qatori bilan). */
function buildSheet<T>(columns: ExportColumn<T>[], rows: T[], opts: { title?: string; subtitle?: string } = {}) {
  const aoa: (string | number)[][] = [];
  if (opts.title) aoa.push([opts.title]);
  if (opts.subtitle) aoa.push([opts.subtitle]);
  aoa.push([`Yaratilgan: ${new Date().toLocaleString("uz-UZ")} · Qatorlar: ${rows.length}`]);
  aoa.push([]);
  aoa.push(columns.map((c) => c.header));
  for (const r of rows) aoa.push(columns.map((c) => c.value(r)));
  if (columns.some((c) => c.total)) {
    aoa.push(columns.map((c, i) => (c.total ? c.total(rows) : i === 0 ? "JAMI" : "")));
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = columns.map((c) => ({ wch: Math.max(12, c.header.length + 2) }));
  return ws;
}

const cleanSheetName = (s: string) => (s || "Sheet").replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

/**
 * Massivni REAL Excel (.xlsx) sifatida yuklab olish (SheetJS) — Numbers ham,
 * Excel ham to'g'ri ochadi (eski HTML-`.xls` hiylasidan farqli).
 */
export function exportToExcel<T>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
  opts: { title?: string; sheet?: string; subtitle?: string } = {},
) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(columns, rows, opts), cleanSheetName(opts.sheet ?? "Hisobot"));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

/** Ko'p varaqli (2-3 tab) Excel workbook — har varaq alohida ustun/qatorlar. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function exportWorkbook(filename: string, sheets: SheetSpec<any>[]) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, buildSheet(s.columns, s.rows, s.opts ?? {}), cleanSheetName(s.name));
  }
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}


/** Hujjat element stillari — print va Word eksport o'rtasida umumiy. */
const DOC_ELEMENT_CSS = `
  *{box-sizing:border-box}
  .doc-head{display:flex;align-items:center;gap:16px;border-bottom:3px solid #0f766e;padding-bottom:20px;margin-bottom:28px}
  .doc-seal{width:58px;height:58px;border-radius:14px;background:#047857;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;font-weight:800}
  .doc-org{font-size:18px;font-weight:800}
  .doc-sub{font-size:13px;color:#64748b}
  h1{font-size:22px;margin:0 0 6px}
  .muted{color:#64748b;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:18px}
  th,td{border:1px solid #e2e8f0;padding:9px 12px;text-align:left;font-size:13px}
  th{background:#f0fdf4;color:#065f46;font-weight:700}
  .meta-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px 28px;margin:18px 0}
  .meta-grid div{font-size:13px}
  .meta-grid b{color:#475569;font-weight:600}
  .badge{display:inline-block;padding:3px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-size:12px;font-weight:600}
  .foot{margin-top:48px;display:flex;justify-content:space-between;font-size:13px;color:#475569;border-top:1px solid #e2e8f0;padding-top:12px}
  .sign{margin-top:36px;border-top:1px dashed #94a3b8;width:240px;padding-top:6px;text-align:center;font-size:12px;color:#64748b}
  .reg{display:flex;justify-content:space-between;font-size:12px;color:#64748b;margin-bottom:10px}
  .legal{background:#f8fafc;border-left:3px solid #0f766e;padding:10px 14px;font-size:12.5px;color:#475569;margin:14px 0;border-radius:0 8px 8px 0}
  .preamble{font-weight:600;margin:18px 0 6px;color:#0f172a;line-height:1.6}
  .sign-grid{display:flex;justify-content:space-between;align-items:flex-end;gap:32px;margin-top:52px}
  .sign-box{flex:1;text-align:center;font-size:12px;color:#475569}
  .sign-line{border-top:1px solid #94a3b8;margin-top:44px;padding-top:6px}
  .qr{width:84px;height:84px;border:1px dashed #cbd5e1;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#94a3b8;text-align:center;line-height:1.3}
  .draft-banner{background:#fff7ed;border:1px dashed #fb923c;color:#c2410c;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;margin-bottom:16px;text-align:center}
`;

/**
 * HTML kontentni chop etish oynasida ochish va print qilish.
 * Yangi oyna ochib, stillangan hujjatni chiqaradi.
 */
export function printHTML(innerHTML: string, title = "Hujjat") {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document
    .write(`<!doctype html><html lang="uz"><head><meta charset="utf-8"/>
<title>${title}</title>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;margin:0;padding:40px;background:#fff}
  .doc-seal{background:linear-gradient(135deg,#10b981,#047857) !important}
  ${DOC_ELEMENT_CSS}
  @media print{body{padding:24px}}
</style></head><body>${innerHTML}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 350);
}

/**
 * To'liq stillangan Word (.doc) hujjatini yuklab olish.
 * Office XML sozlamalari + A4 sahifa o'lchami bilan — Word'da rasmiy hujjatdek ochiladi.
 */
export function exportToWord(
  filename: string,
  bodyHTML: string,
  title = "Hujjat",
) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /><title>${title}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  @page WordSection1{size:21cm 29.7cm;margin:2cm 2.2cm}
  div.WordSection1{page:WordSection1}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;font-size:13px}
  .doc-seal{background:#047857}
  ${DOC_ELEMENT_CSS}
</style>
</head><body><div class="WordSection1">${bodyHTML}</div></body></html>`;
  downloadBlob(
    new Blob(["\uFEFF" + html], { type: "application/msword;charset=utf-8" }),
    filename.endsWith(".doc") ? filename : `${filename}.doc`,
  );
}

/**
 * Umumiy jadvalni rasmiy blank bilan chop etish.
 * Sarlavha + ustunlar + qatorlar — ro'yxatlarni chop etish uchun.
 */
export function printTable<T>(opts: {
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}) {
  const head = `<tr>${opts.columns
    .map((c) => `<th style="text-align:${c.align ?? "left"}">${c.header}</th>`)
    .join("")}</tr>`;
  const body = opts.rows
    .map(
      (r) =>
        `<tr>${opts.columns
          .map(
            (c) =>
              `<td style="text-align:${c.align ?? "left"}">${c.value(r) ?? ""}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  const hasTotals = opts.columns.some((c) => c.total);
  const foot = hasTotals
    ? `<tr>${opts.columns
        .map(
          (c, i) =>
            `<td style="text-align:${c.align ?? "left"};font-weight:bold;background:#f0fdf4;color:#065f46">${
              c.total ? c.total(opts.rows) : i === 0 ? "JAMI" : ""
            }</td>`,
        )
        .join("")}</tr>`
    : "";
  printHTML(
    `<div class="doc-head"><div class="doc-seal">H</div>
      <div><div class="doc-org">Tuman Hokimligi</div>
      <div class="doc-sub">${opts.subtitle ?? "Raqamli boshqaruv tizimi"}</div></div></div>
    <h1>${opts.title}</h1>
    <p class="muted">Chop etilgan: ${new Date().toLocaleString("uz-UZ")} · Jami: ${opts.rows.length} ta</p>
    <table>${head}${body}${foot}</table>
    <div class="foot"><span class="muted">Tuman Hokimligi · raqamli boshqaruv tizimi</span><span class="muted">${opts.rows.length} ta yozuv</span></div>`,
    opts.title,
  );
}
