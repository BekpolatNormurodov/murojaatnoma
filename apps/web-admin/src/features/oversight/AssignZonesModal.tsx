import { useMemo, useState } from 'react';
import { CloseCircle, Location, RotateRight, SearchNormal1, TickCircle, TickSquare } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { matchesSearch } from '@/shared/lib/translit';
import { territoryOf } from '@/shared/lib/territory';
import { useMahallas, useAssignZones } from './useZones';
import type { OversightRow } from './useOversight';

/**
 * Xodimga hudud (mahalla) biriktirish. Belgilangan mahallalar — shu xodim
 * "bo'lishi kerak" bo'lgan hudud; jonli lokatsiya shulardan tashqarida bo'lsa
 * Nazorat jadvalida "Tashqarida" deb ko'rsatiladi. Hech biri tanlanmasa —
 * hudud biriktirilmagan hisoblanadi.
 */
export function AssignZonesModal({
  row,
  onClose,
  onDone,
}: {
  row: Pick<OversightRow, 'employeeId' | 'fullName' | 'assignedMahallaCodes'> & {
    location?: Pick<OversightRow['location'], 'hasLocation' | 'mahallaName'>;
  } | null;
  onClose: () => void;
  /** Saqlangandan keyingi xabar (toast). */
  onDone?: (msg: string) => void;
}) {
  const { data: mahallas, isLoading, isError, error: loadError, refetch, isFetching } = useMahallas();
  const assign = useAssignZones();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Faqat modal ochilganda (yoki boshqa xodimga o'tilganda) joriy mahallalar
  // bilan to'ldiriladi — sahifa qayta chizilsa saqlanmagan belgilar o'chmaydi.
  const openFor = row?.employeeId ?? null;
  const [filledFor, setFilledFor] = useState<string | null>(null);
  if (openFor !== filledFor) {
    setFilledFor(openFor);
    if (row) {
      setSelected(new Set(row.assignedMahallaCodes));
      setQ('');
      setError(null);
    }
  }

  const list = useMemo(() => {
    // Defensive: never assume the API returned an array (a transient error page
    // or envelope would otherwise crash the list render with `.map is not a function`).
    const all = Array.isArray(mahallas) ? mahallas : [];
    if (!q.trim()) return all;
    // Kirill/lotin farqisiz — kod bo'yicha ham (matchesSearch kodni ham qamraydi).
    return all.filter((m) => matchesSearch(q, m.nameUzLat, m.nameUzCyr, m.code));
  }, [mahallas, q]);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const byCode = useMemo(
    () => new Map((Array.isArray(mahallas) ? mahallas : []).map((m) => [m.code, m])),
    [mahallas],
  );
  const initial = useMemo(() => new Set(row?.assignedMahallaCodes ?? []), [row]);
  const changed = selected.size !== initial.size || [...selected].some((c) => !initial.has(c));
  const allVisibleSelected = list.length > 0 && list.every((m) => selected.has(m.code));

  function toggleVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) list.forEach((m) => next.delete(m.code));
      else list.forEach((m) => next.add(m.code));
      return next;
    });
  }

  async function save() {
    if (!row) return;
    setError(null);
    try {
      const res = await assign.mutateAsync({ employeeId: row.employeeId, mahallaCodes: [...selected] });
      const where = res?.lastLocationAt
        ? ` — oxirgi lokatsiya bo'yicha: ${
            {
              zone: 'hududda',
              office: 'ofisda',
              outside: 'hududdan tashqarida',
              none: 'hudud biriktirilmagan',
            }[territoryOf(res.lastInsideAssignedZone, res.lastInsideOffice, selected.size > 0)]
          }`
        : '';
      onDone?.(
        `${row.fullName}: ${selected.size ? `${selected.size} ta mahalla biriktirildi` : 'mahallalar olib tashlandi'}${where}`,
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    }
  }

  return (
    <Modal
      open={!!row}
      // Saqlanayotganda fon / Esc / × yopmaydi — xato xabari yo'qolmasin.
      onClose={() => (assign.isPending ? undefined : onClose())}
      title="Hudud biriktirish"
      subtitle={row ? `${row.fullName} — qaysi mahallalarda bo'lishi kerak` : undefined}
      width={560}
    >
      <div className="space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-danger-soft p-3 text-[13px] font-medium text-red-700">
            <CloseCircle size={18} variant="Bulk" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-[13px]">
          <span className="flex items-center gap-2 text-ink-soft">
            <TickSquare size={16} variant="Bulk" className="text-primary-600" />
            Tanlangan: <span className="font-semibold text-ink">{selected.size}</span> ta mahalla
          </span>
          {selected.size > 0 && (
            <button
              onClick={() => setSelected(new Set())}
              disabled={assign.isPending}
              className="text-[12.5px] font-medium text-ink-muted hover:text-danger disabled:opacity-50"
            >
              Tozalash
            </button>
          )}
        </div>

        {row?.location?.hasLocation && row.location.mahallaName && (
          <p className="flex items-center gap-1.5 text-[12.5px] text-ink-soft">
            <Location size={14} variant="Bulk" className="shrink-0 text-primary-600" />
            Hozir: <span className="font-medium text-ink">{row.location.mahallaName}</span>
          </p>
        )}

        {selected.size > 0 && (
          <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
            {[...selected].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => toggle(code)}
                disabled={assign.isPending}
                title="Olib tashlash"
                className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-[12px] font-medium text-primary-700 hover:bg-danger-soft hover:text-red-700"
              >
                {byCode.get(code)?.nameUzLat ?? code}
                <CloseCircle size={13} />
              </button>
            ))}
          </div>
        )}

        {selected.size === 0 && (
          <p className="flex items-center gap-1.5 rounded-lg bg-info-soft px-3 py-2 text-[12px] text-accent-700">
            <Location size={14} variant="Bulk" className="shrink-0" />
            Hech biri tanlanmasa — hudud biriktirilmagan bo'ladi va hududdagi vaqt hisoblanmaydi.
          </p>
        )}

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="relative border-b border-line">
            <SearchNormal1 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Mahalla nomi yoki kodi bo'yicha qidirish..."
              className="h-11 w-full bg-transparent pl-10 pr-28 text-sm text-ink outline-none placeholder:text-ink-muted"
            />
            {list.length > 0 && (
              <button
                type="button"
                onClick={toggleVisible}
                disabled={assign.isPending}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[12px] font-medium text-primary-600 hover:bg-primary-50"
              >
                {allVisibleSelected ? 'Bekor qilish' : q.trim() ? `Topilganlar (${list.length})` : 'Hammasi'}
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {isLoading ? (
              <div className="space-y-1.5 p-1.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-2" />
                ))}
              </div>
            ) : isError && !Array.isArray(mahallas) ? (
              <div role="alert" className="flex flex-col items-center gap-2.5 px-3 py-8 text-center">
                <p className="text-[13px] font-medium text-red-700">
                  Mahallalar ro'yxatini yuklab bo'lmadi
                  {loadError instanceof Error && (
                    <span className="mt-0.5 block font-normal text-ink-muted">{loadError.message}</span>
                  )}
                </p>
                <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
                  <RotateRight size={16} className={cn(isFetching && 'animate-spin')} /> Qayta urinish
                </Button>
              </div>
            ) : list.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-ink-muted">Mahalla topilmadi</p>
            ) : (
              list.map((m) => {
                const active = selected.has(m.code);
                return (
                  <button
                    key={m.code}
                    type="button"
                    onClick={() => toggle(m.code)}
                    aria-pressed={active}
                    disabled={assign.isPending}
                    className={cn(
                      'flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                      active ? 'bg-primary-50' : 'hover:bg-surface-2',
                    )}
                  >
                    <span
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
                        active ? 'border-primary-500 bg-primary-500 text-white' : 'border-line bg-surface',
                      )}
                    >
                      {active && <TickCircle size={14} variant="Bold" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[13px] font-medium', active ? 'text-primary-700' : 'text-ink')}>
                        {m.nameUzLat}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-ink-muted">{m.code}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose} disabled={assign.isPending}>
            Bekor qilish
          </Button>
          <Button onClick={save} disabled={assign.isPending || !changed} title={changed ? undefined : "O'zgarish yo'q"}>
            {assign.isPending ? <RotateRight size={18} className="animate-spin" /> : <TickCircle size={18} />}
            {assign.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
