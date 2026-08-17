import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  DocumentText,
  DocumentDownload,
  Add,
  SearchNormal1,
  Folder2,
  ClipboardText,
  Note1,
  TaskSquare,
  Printer,
  ExportSquare,
  More,
  Eye,
  Chart21,
  Sort,
  CloseCircle,
  RotateRight,
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { StatCard } from '@/shared/ui/StatCard';
import { Badge } from '@/shared/ui/Badge';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Dropdown } from '@/shared/ui/Dropdown';
import { Select } from '@/shared/ui/Select';
import type { GovDocStatus, GovDocType, GovDocument } from '@/shared/data/types';
import { formatDate } from '@/shared/lib/format';
import { exportToCSV, exportToExcel, fileStamp, printHTML, printTable } from '@/shared/lib/export';
import { cn } from '@/shared/lib/cn';
import { useDocuments } from './useDocuments';
import { DOC_EXPORT_COLUMNS, STATUS_DOT, STATUS_META, TYPE_META, buildDocHTML, formatSize } from './meta';
import { AddDocumentModal, DocumentPreviewModal, ReportsModal } from './DocumentModals';

type SortKey = 'new' | 'old' | 'name' | 'size';
const SORT_LABEL: Record<SortKey, string> = {
  new: 'Avval yangi',
  old: 'Avval eski',
  name: 'Nomi (A-Z)',
  size: 'Hajmi bo\u02bbyicha',
};

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}

const DEFAULT_TYPE_META = { label: "Boshqa", icon: DocumentText, color: '#94a3b8' };
const DEFAULT_STATUS_META = { label: "Noma'lum", tone: 'neutral' as const };

/** TYPE_META'da yo'q (kutilmagan) hujjat turi uchun neytral fallback. */
function typeMeta(type: GovDocType) {
  return TYPE_META[type] ?? DEFAULT_TYPE_META;
}

/** STATUS_META'da yo'q (kutilmagan) holat uchun neytral fallback. */
function statusMeta(status: GovDocStatus) {
  return STATUS_META[status] ?? DEFAULT_STATUS_META;
}

/**
 * DOC_EXPORT_COLUMNS bilan bir xil, lekin Turi/Holati ustunlari
 * xavfsiz (fallback'li) meta orqali o'qiladi — eksport kutilmagan
 * qiymatda qulamasligi uchun.
 */
const SAFE_DOC_EXPORT_COLUMNS: typeof DOC_EXPORT_COLUMNS = DOC_EXPORT_COLUMNS.map((col) => {
  if (col.header === 'Turi') return { ...col, value: (d: GovDocument) => typeMeta(d.type).label };
  if (col.header === 'Holati') return { ...col, value: (d: GovDocument) => statusMeta(d.status).label };
  return col;
});

export function DocumentsPage() {
  const { data, isLoading, isError, error, refetch } = useDocuments();
  const [docs, setDocs] = useState<GovDocument[]>([]);
  const [type, setType] = useState<GovDocType | 'all'>('all');
  const [status, setStatus] = useState<GovDocStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('new');

  const [addOpen, setAddOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [preview, setPreview] = useState<GovDocument | null>(null);

  useEffect(() => {
    if (data) setDocs(data.map((d) => ({ ...d })));
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = docs.filter((d) => {
      if (type !== 'all' && d.type !== type) return false;
      if (status !== 'all' && d.status !== status) return false;
      if (q && !d.title.toLowerCase().includes(q) && !d.code.toLowerCase().includes(q)) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === 'new') return +new Date(b.createdAt) - +new Date(a.createdAt);
      if (sort === 'old') return +new Date(a.createdAt) - +new Date(b.createdAt);
      if (sort === 'name') return a.title.localeCompare(b.title);
      return b.sizeKb - a.sizeKb;
    });
  }, [docs, type, status, query, sort]);

  const counts = useMemo(
    () => ({
      total: docs.length,
      signed: docs.filter((d) => d.status === 'signed').length,
      review: docs.filter((d) => d.status === 'review').length,
      draft: docs.filter((d) => d.status === 'draft').length,
      archived: docs.filter((d) => d.status === 'archived').length,
    }),
    [docs],
  );

  const byType = useMemo(
    () =>
      (Object.keys(TYPE_META) as GovDocType[]).map((t) => ({
        type: t,
        count: docs.filter((d) => d.type === t).length,
      })),
    [docs],
  );

  function handlePrintDoc(doc: GovDocument) {
    printHTML(buildDocHTML(doc), doc.code);
  }

  return (
    <div>
      <PageHeader
        title="Hujjatlar"
        subtitle="Hokimiyat qarorlari, buyruqlar, hisobotlar va shartnomalar arxivi"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setReportsOpen(true)}>
              <Chart21 size={18} variant="Bulk" /> Hisobotlar
            </Button>
            <Dropdown
              align="end"
              width={230}
              trigger={
                <Button variant="secondary">
                  <ExportSquare size={18} /> Eksport
                </Button>
              }
              items={[
                {
                  label: 'Excel (.xls) yuklab olish',
                  icon: TaskSquare,
                  onClick: () =>
                    exportToExcel(`hokimlik-hujjatlar_${fileStamp()}`, SAFE_DOC_EXPORT_COLUMNS, filtered, {
                      title: 'Hujjatlar roʻyxati',
                      subtitle: `Holat: ${status === 'all' ? 'barchasi' : statusMeta(status).label} · ${filtered.length} ta`,
                      sheet: 'Hujjatlar',
                    }),
                },
                {
                  label: 'CSV yuklab olish',
                  icon: DocumentDownload,
                  onClick: () => exportToCSV(`hokimlik-hujjatlar_${fileStamp()}`, SAFE_DOC_EXPORT_COLUMNS, filtered),
                },
                {
                  label: 'Ro\u02bbyxatni chop etish',
                  icon: Printer,
                  divider: true,
                  onClick: () => printList(filtered),
                },
              ]}
            />
            <Button onClick={() => setAddOpen(true)}>
              <Add size={18} /> Yangi hujjat
            </Button>
          </div>
        }
      />

      {isError ? (
        <Card className="flex flex-col items-center gap-3 p-14 text-center">
          <CloseCircle size={40} variant="Bulk" className="text-danger" />
          <div>
            <p className="font-semibold text-ink">Ma'lumotlarni yuklab bo'lmadi</p>
            <p className="mt-1 text-sm text-ink-muted">
              {error instanceof Error ? error.message : "Noma'lum xatolik yuz berdi"}
            </p>
          </div>
          <Button variant="secondary" onClick={() => refetch()}>
            <RotateRight size={16} /> Qayta urinish
          </Button>
        </Card>
      ) : (
        <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[104px]" />)
        ) : (
          <>
            <StatCard icon={Folder2} label="Jami hujjatlar" value={String(counts.total)} tint="#6366f1" index={0} />
            <StatCard icon={TaskSquare} label="Imzolangan" value={String(counts.signed)} tint="#10b981" index={1} />
            <StatCard icon={ClipboardText} label="Ko'rib chiqilmoqda" value={String(counts.review)} tint="#f59e0b" index={2} />
            <StatCard icon={Note1} label="Qoralama" value={String(counts.draft)} tint="#94a3b8" index={3} />
            <StatCard icon={DocumentText} label="Arxivda" value={String(counts.archived)} tint="#06b6d4" index={4} />
          </>
        )}
      </div>

      {/* Type quick filters */}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button
          onClick={() => setType('all')}
          className={cn(
            'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
            type === 'all'
              ? 'border-primary-300 bg-primary-50 text-primary-700'
              : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
          )}
        >
          <Folder2 size={16} variant="Bulk" /> Barchasi
          <span className="rounded-md bg-surface-2 px-1.5 text-[11px]">{docs.length}</span>
        </button>
        {byType.map((b) => {
          const meta = TYPE_META[b.type];
          const Ic = meta.icon;
          const active = type === b.type;
          return (
            <button
              key={b.type}
              onClick={() => setType(b.type)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors',
                active ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
              )}
            >
              <Ic size={16} variant="Bulk" style={{ color: active ? undefined : meta.color }} />
              {meta.label}
              <span className="rounded-md bg-surface-2 px-1.5 text-[11px]">{b.count}</span>
            </button>
          );
        })}
      </div>

      {/* Search + status + sort */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchNormal1 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hujjat nomi yoki kodi bo'yicha qidirish..."
            className="h-11 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300"
          />
        </div>
        <Dropdown
          align="end"
          width={200}
          trigger={
            <button className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2">
              <Sort size={17} /> {SORT_LABEL[sort]}
            </button>
          }
          items={(Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({
            label: SORT_LABEL[k],
            active: sort === k,
            onClick: () => setSort(k),
          }))}
        />
        <Select
          size="md"
          menuAlign="end"
          value={status}
          onChange={(v) => setStatus(v as GovDocStatus | 'all')}
          options={[
            { value: 'all', label: 'Barcha holatlar' },
            ...(Object.keys(STATUS_META) as GovDocStatus[]).map((s) => ({
              value: s,
              label: STATUS_META[s].label,
              dot: STATUS_DOT[s],
            })),
          ]}
        />
      </div>

      {/* Table */}
      <Card className="mt-5 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5">
          <h3 className="text-[15px] font-semibold text-ink">Hujjatlar ro'yxati</h3>
          <span className="text-xs text-ink-muted">{filtered.length} ta topildi</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-200 text-left text-sm">
            <thead>
              <tr className="border-y border-line text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="px-5 py-3 font-semibold">Hujjat</th>
                <th className="px-3 py-3 font-semibold">Turi</th>
                <th className="px-3 py-3 font-semibold">Holat</th>
                <th className="px-3 py-3 font-semibold">Muallif</th>
                <th className="px-3 py-3 font-semibold">Hudud</th>
                <th className="px-3 py-3 font-semibold">Sana</th>
                <th className="px-3 py-3 font-semibold">Hajmi</th>
                <th className="px-5 py-3 text-right font-semibold">Amal</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-line/70">
                      <td className="px-5 py-3.5" colSpan={8}>
                        <Skeleton className="h-8" />
                      </td>
                    </tr>
                  ))
                : filtered.map((d, i) => (
                    <DocRow
                      key={d.id}
                      doc={d}
                      index={i}
                      onView={() => setPreview(d)}
                      onDownload={() => setPreview(d)}
                      onPrint={() => handlePrintDoc(d)}
                    />
                  ))}
            </tbody>
          </table>
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Folder2 size={40} variant="Bulk" className="text-ink-muted" />
              <p className="mt-3 text-sm text-ink-soft">Hujjat topilmadi</p>
            </div>
          )}
        </div>
      </Card>
        </>
      )}

      {/* Modals */}
      <AddDocumentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={(doc) => setDocs((prev) => [doc, ...prev])}
      />
      <DocumentPreviewModal doc={preview} onClose={() => setPreview(null)} />
      <ReportsModal open={reportsOpen} onClose={() => setReportsOpen(false)} docs={docs} />
    </div>
  );
}

function DocRow({
  doc,
  index,
  onView,
  onDownload,
  onPrint,
}: {
  doc: GovDocument;
  index: number;
  onView: () => void;
  onDownload: () => void;
  onPrint: () => void;
}) {
  const meta = typeMeta(doc.type);
  const Ic = meta.icon;
  const st = statusMeta(doc.status);
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.025, 0.3) }}
      className="border-b border-line/70 transition-colors hover:bg-surface-2"
    >
      <td className="px-5 py-3">
        <button onClick={onView} className="flex items-center gap-3 text-left">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `${meta.color}1a` }}
          >
            <Ic size={20} variant="Bulk" style={{ color: meta.color }} />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium text-ink hover:text-primary-600">{doc.title}</div>
            <div className="font-mono text-[11px] text-ink-muted">{doc.code}</div>
          </div>
        </button>
      </td>
      <td className="px-3 py-3 text-ink-soft">{meta.label}</td>
      <td className="px-3 py-3">
        <Badge tone={st.tone} dot>
          {st.label}
        </Badge>
      </td>
      <td className="px-3 py-3 text-ink-soft">{doc.author}</td>
      <td className="px-3 py-3 text-ink-soft">{doc.region}</td>
      <td className="px-3 py-3 text-ink-soft">{formatDate(doc.createdAt)}</td>
      <td className="px-3 py-3 text-ink-muted">
        {formatSize(doc.sizeKb)} · {doc.pages} bet
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={onView}
            title="Ko'rish"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600"
          >
            <Eye size={17} />
          </button>
          <button
            onClick={onPrint}
            title="Chop etish"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600"
          >
            <Printer size={17} />
          </button>
          <Dropdown
            align="end"
            width={200}
            trigger={
              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink">
                <More size={18} />
              </button>
            }
            items={[
              { label: "Ko'rish", icon: Eye, onClick: onView },
              { label: 'Yuklab olish', icon: DocumentDownload, onClick: onDownload },
              { label: 'Chop etish', icon: Printer, onClick: onPrint },
            ]}
          />
        </div>
      </td>
    </motion.tr>
  );
}

/** Filtrlangan ro'yxatni chop etish. */
function printList(docs: GovDocument[]) {
  let n = 0;
  printTable({
    title: `Hujjatlar ro'yxati (${docs.length} ta)`,
    subtitle: 'Hujjatlar ro\u02bbyxati',
    columns: [
      { header: '№', value: () => ++n, align: 'center' },
      { header: 'Kod', value: (d) => d.code },
      { header: 'Nomi', value: (d) => d.title },
      { header: 'Turi', value: (d) => typeMeta(d.type).label },
      { header: 'Holati', value: (d) => statusMeta(d.status).label },
      { header: 'Muallif', value: (d) => d.author },
      { header: 'Sana', value: (d) => formatDate(d.createdAt) },
    ],
    rows: docs,
  });
}
