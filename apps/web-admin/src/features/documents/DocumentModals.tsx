import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Printer,
  DocumentDownload,
  ExportSquare,
  TaskSquare,
  TickCircle,
  Add,
  Chart21,
  DocumentText,
  Copy,
  CopySuccess,
  Calendar,
} from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Select } from '@/shared/ui/Select';
import { Dropdown } from '@/shared/ui/Dropdown';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/format';
import { copyToClipboard, exportToExcel, exportToWord, fileStamp, printHTML } from '@/shared/lib/export';
import type { GovDocStatus, GovDocType, GovDocument } from '@/shared/data/types';
import { DISTRICTS } from '@/shared/data/mock';
import {
  DOC_EXPORT_COLUMNS,
  STATUS_DOT,
  STATUS_FLOW,
  STATUS_META,
  TYPE_META,
  buildDocHTML,
  docRegNo,
  formatSize,
  statusStep,
} from './meta';

const REGION_OPTIONS = ['Barcha tumanlar', ...DISTRICTS.map((d) => d.name)];
const TYPE_KEYS = Object.keys(TYPE_META) as GovDocType[];
const STATUS_KEYS = Object.keys(STATUS_META) as GovDocStatus[];
const CODE_PREFIX: Record<GovDocType, string> = {
  qaror: 'QR',
  buyruq: 'BY',
  hisobot: 'HS',
  shartnoma: 'SH',
  ariza: 'AR',
  dalolatnoma: 'DL',
};

/* ============================================================
   Yangi hujjat qo'shish modali
   ============================================================ */
export function AddDocumentModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (doc: GovDocument) => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<GovDocType>('qaror');
  const [status, setStatus] = useState<GovDocStatus>('draft');
  const [author, setAuthor] = useState('');
  const [region, setRegion] = useState(REGION_OPTIONS[0]);
  const [pages, setPages] = useState(4);

  const valid = title.trim().length > 2 && author.trim().length > 1;

  function reset() {
    setTitle('');
    setType('qaror');
    setStatus('draft');
    setAuthor('');
    setRegion(REGION_OPTIONS[0]);
    setPages(4);
  }

  function submit() {
    if (!valid) return;
    const doc: GovDocument = {
      id: `D-${Date.now()}`,
      code: `${CODE_PREFIX[type]}-2026/${Math.floor(100 + Math.random() * 800)}`,
      title: title.trim(),
      type,
      status,
      author: author.trim(),
      region,
      createdAt: new Date().toISOString(),
      sizeKb: pages * 120 + Math.floor(Math.random() * 200),
      pages,
    };
    onCreate(doc);
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Yangi hujjat" subtitle="Hujjat ma'lumotlarini kiriting" width={560}>
      <div className="space-y-4">
        <Field label="Hujjat nomi">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Masalan: Obodonlashtirish bo'yicha qaror"
            className="h-11 w-full rounded-xl border border-line bg-surface-2 px-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300 focus:bg-surface"
          />
        </Field>

        <Field label="Hujjat turi">
          <div className="grid grid-cols-3 gap-2">
            {TYPE_KEYS.map((k) => {
              const m = TYPE_META[k];
              const active = type === k;
              return (
                <button
                  key={k}
                  onClick={() => setType(k)}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-all',
                    active
                      ? 'border-primary-300 bg-primary-50 text-primary-700'
                      : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
                  )}
                >
                  <m.icon size={16} variant="Bulk" style={{ color: active ? undefined : m.color }} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Muallif">
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="F.I.Sh."
              className="h-11 w-full rounded-xl border border-line bg-surface-2 px-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300 focus:bg-surface"
            />
          </Field>
          <Field label="Hudud">
            <Select
              block
              value={region}
              onChange={setRegion}
              options={REGION_OPTIONS.map((r) => ({ value: r, label: r }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Holati">
            <Select
              block
              value={status}
              onChange={(v) => setStatus(v as GovDocStatus)}
              options={STATUS_KEYS.map((s) => ({
                value: s,
                label: STATUS_META[s].label,
                dot: STATUS_DOT[s],
              }))}
            />
          </Field>
          <Field label={`Betlar soni: ${pages}`}>
            <input
              type="range"
              min={1}
              max={40}
              value={pages}
              onChange={(e) => setPages(Number(e.target.value))}
              className="mt-3 w-full accent-primary-600"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button onClick={submit} disabled={!valid}>
            <Add size={18} /> Hujjat yaratish
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</label>
      {children}
    </div>
  );
}

/* ============================================================
   Hujjatni ko'rish / preview modali
   ============================================================ */
export function DocumentPreviewModal({
  doc,
  onClose,
}: {
  doc: GovDocument | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handlePrint() {
    if (doc) printHTML(buildDocHTML(doc), doc.code);
  }
  function handleWord() {
    if (doc) exportToWord(`${doc.code}`, buildDocHTML(doc), doc.code);
  }
  function handleExcel() {
    if (doc) exportToExcel(`${doc.code}`, DOC_EXPORT_COLUMNS, [doc], { title: doc.title });
  }
  async function handleCopy() {
    if (!doc) return;
    const ok = await copyToClipboard(doc.code);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }

  const step = doc ? statusStep(doc.status) : 0;

  return (
    <Modal open={!!doc} onClose={onClose} width={640} showClose>
      {doc && (
        <div>
          <div className="flex items-start gap-3">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: `${TYPE_META[doc.type].color}1a` }}
            >
              {(() => {
                const Ic = TYPE_META[doc.type].icon;
                return <Ic size={26} variant="Bulk" style={{ color: TYPE_META[doc.type].color }} />;
              })()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleCopy}
                  title="Kodni nusxalash"
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border border-line px-2 py-0.5 font-mono text-[12px] transition-colors',
                    copied ? 'border-primary-200 bg-success-soft text-primary-700' : 'text-ink-muted hover:bg-surface-2',
                  )}
                >
                  {doc.code}
                  {copied ? (
                    <CopySuccess size={13} variant="Bulk" className="text-primary-600" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
                <span className="font-mono text-[11px] text-ink-muted">{docRegNo(doc)}</span>
                <Badge tone={STATUS_META[doc.status].tone} dot>
                  {STATUS_META[doc.status].label}
                </Badge>
              </div>
              <h2 className="mt-1 text-lg font-bold leading-snug text-ink">{doc.title}</h2>
            </div>
          </div>

          {/* Status timeline */}
          <div className="mt-5 flex items-center gap-0 rounded-2xl border border-line bg-surface p-3">
            {STATUS_FLOW.map((stage, i) => {
              const done = i <= step;
              const isLast = i === STATUS_FLOW.length - 1;
              return (
                <div key={stage.key} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors',
                        done ? 'bg-primary-600 text-white' : 'bg-surface-2 text-ink-muted',
                      )}
                    >
                      {done ? <TickCircle size={15} variant="Bulk" /> : i + 1}
                    </span>
                    <span className={cn('text-center text-[10.5px] font-medium', done ? 'text-ink' : 'text-ink-muted')}>
                      {stage.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div className={cn('mx-1 h-0.5 flex-1 rounded-full', i < step ? 'bg-primary-500' : 'bg-line')} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Meta grid */}
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-surface-2 p-4 text-[13px] sm:grid-cols-4">
            <Meta label="Turi" value={TYPE_META[doc.type].label} />
            <Meta label="Muallif" value={doc.author} />
            <Meta label="Hudud" value={doc.region} />
            <Meta label="Sana" value={formatDate(doc.createdAt)} />
            <Meta label="Hajmi" value={formatSize(doc.sizeKb)} />
            <Meta label="Betlar" value={`${doc.pages} bet`} />
            <Meta label="Format" value={`${doc.pages > 10 ? 'A4 · ko\u02bbp betli' : 'A4'}`} />
            <Meta label="Versiya" value="v1.0" />
          </div>

          {/* Faux preview — rasmiy hujjatga yaqin */}
          <div className="mt-4 rounded-2xl border border-line bg-white p-5 shadow-inner">
            <div className="flex items-center gap-2 border-b-2 border-primary-600 pb-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-primary-500 to-primary-700 text-sm font-black text-white">
                H
              </span>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-slate-800">Tuman Hokimligi</div>
                <div className="text-[10px] text-slate-500">Rasmiy hujjat · {docRegNo(doc)}</div>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <Calendar size={11} /> {formatDate(doc.createdAt)}
              </span>
            </div>
            <div className="space-y-2 pt-3">
              <div className="h-3 w-2/3 rounded bg-slate-200" />
              <div className="h-2.5 w-full rounded bg-slate-100" />
              <div className="h-2.5 w-11/12 rounded bg-slate-100" />
              <div className="h-2.5 w-5/6 rounded bg-slate-100" />
              <div className="mt-3 flex items-center justify-between border-t border-dashed border-slate-200 pt-3">
                <div className="h-6 w-20 rounded bg-slate-100" />
                <div className="h-10 w-10 rounded border border-dashed border-slate-300" />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
            <Dropdown
              align="start"
              direction="up"
              width={230}
              trigger={
                <button className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2">
                  <DocumentDownload size={18} /> Yuklab olish
                </button>
              }
              items={[
                { label: 'Word hujjati (.doc)', icon: DocumentText, onClick: handleWord },
                { label: 'Excel jadval (.xls)', icon: TaskSquare, onClick: handleExcel },
              ]}
            />
            <Button variant="secondary" onClick={handlePrint}>
              <Printer size={18} /> Chop etish / PDF
            </Button>
            <Button onClick={onClose}>
              <TickCircle size={18} variant="Bulk" /> Yopish
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-ink-muted">{label}</div>
      <div className="mt-0.5 truncate font-semibold text-ink">{value}</div>
    </div>
  );
}

/* ============================================================
   Hisobotlar modali
   ============================================================ */
export function ReportsModal({
  open,
  onClose,
  docs,
}: {
  open: boolean;
  onClose: () => void;
  docs: GovDocument[];
}) {
  const stats = useMemo(() => {
    const byType = TYPE_KEYS.map((t) => ({
      type: t,
      label: TYPE_META[t].label,
      color: TYPE_META[t].color,
      count: docs.filter((d) => d.type === t).length,
    }));
    const byStatus = STATUS_KEYS.map((s) => ({
      status: s,
      label: STATUS_META[s].label,
      count: docs.filter((d) => d.status === s).length,
    }));
    const max = Math.max(1, ...byType.map((b) => b.count));
    return { byType, byStatus, max, total: docs.length };
  }, [docs]);

  function exportReport() {
    exportToExcel(`hokimlik-hisobot_${fileStamp()}`, DOC_EXPORT_COLUMNS, docs, {
      title: 'Hujjatlar bo\u02bbyicha hisobot',
      subtitle: `Jami ${docs.length} ta hujjat \u00b7 ${new Date().toLocaleDateString('uz-UZ')}`,
      sheet: 'Hujjatlar',
    });
  }

  function printReport() {
    const rows = stats.byType
      .map((b) => `<tr><td>${b.label}</td><td>${b.count}</td></tr>`)
      .join('');
    const statusRows = stats.byStatus
      .map((b) => `<tr><td>${b.label}</td><td>${b.count}</td></tr>`)
      .join('');
    printHTML(
      `<div class="doc-head"><div class="doc-seal">H</div>
        <div><div class="doc-org">Tuman Hokimligi</div>
        <div class="doc-sub">Hujjatlar bo'yicha umumiy hisobot</div></div></div>
      <h1>Hisobot — ${stats.total} ta hujjat</h1>
      <p class="muted">Yaratilgan: ${new Date().toLocaleString('uz-UZ')}</p>
      <h3>Turlar kesimida</h3>
      <table><tr><th>Tur</th><th>Soni</th></tr>${rows}</table>
      <h3 style="margin-top:20px">Holatlar kesimida</h3>
      <table><tr><th>Holat</th><th>Soni</th></tr>${statusRows}</table>`,
      'Hisobot',
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Hujjatlar hisoboti" subtitle="Statistik tahlil va eksport" width={600}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-primary-50 p-4">
            <div className="text-2xl font-bold text-primary-700">{stats.total}</div>
            <div className="text-[13px] text-ink-soft">Jami hujjatlar</div>
          </div>
          <div className="rounded-2xl bg-success-soft p-4">
            <div className="text-2xl font-bold text-primary-700">
              {stats.byStatus.find((s) => s.status === 'signed')?.count ?? 0}
            </div>
            <div className="text-[13px] text-ink-soft">Imzolangan</div>
          </div>
        </div>

        {/* Bar chart (type) */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <Chart21 size={18} variant="Bulk" className="text-primary-600" /> Turlar bo'yicha taqsimot
          </h4>
          <div className="space-y-2.5">
            {stats.byType.map((b, i) => (
              <div key={b.type} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[13px] text-ink-soft">{b.label}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-lg bg-surface-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(b.count / stats.max) * 100}%` }}
                    transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="flex h-full items-center justify-end rounded-lg pr-2 text-[11px] font-bold text-white"
                    style={{ background: b.color, minWidth: 28 }}
                  >
                    {b.count}
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={printReport}>
            <Printer size={18} /> Chop etish
          </Button>
          <Button variant="secondary" onClick={exportReport}>
            <TaskSquare size={18} variant="Bulk" /> Excel hisobot
          </Button>
          <Button onClick={onClose}>
            <ExportSquare size={18} /> Yopish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
