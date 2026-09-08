import { useMemo } from 'react';
import { Calendar, CloseCircle, RotateRight, TickCircle, WalletMoney } from 'iconsax-react';
import { Drawer } from '@/shared/ui/Drawer';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { formatSom } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { useSalaryHistory, type SalaryRosterRow } from './useSalaries';

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

/**
 * Bitta xodimning oylik maosh tarixi — yon panel (drawer). Har bir oy uchun
 * asosiy + ustama − ushlanma = sof to'lov va to'lov holati ko'rsatiladi, tepada
 * umumiy yig'indi bilan. Ma'lumot faqat drawer ochilganda so'raladi.
 */
export function SalaryHistoryDrawer({
  row,
  onClose,
}: {
  row: SalaryRosterRow | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError, refetch } = useSalaryHistory(row?.employeeId ?? null);

  const totals = useMemo(() => {
    const list = data ?? [];
    return {
      months: list.length,
      net: list.reduce((s, r) => s + r.net, 0),
      paid: list.filter((r) => r.paidAt).length,
    };
  }, [data]);

  return (
    <Drawer open={!!row} onClose={onClose} title="Oylik tarixi" subtitle={row?.fullName} width={480}>
      {row && (
        <div className="flex-1 overflow-y-auto p-5">
          {/* Xodim kartasi */}
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <Avatar name={row.fullName} src={row.avatarUrl ?? undefined} size={44} />
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{row.fullName}</div>
              <div className="truncate text-[12.5px] text-ink-muted">{row.position}</div>
            </div>
          </div>

          {/* Umumiy */}
          {!isLoading && !isError && (data?.length ?? 0) > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Jami to'langan (sof)</p>
                <p className="mt-0.5 text-[17px] font-bold tabular-nums text-primary-700">{formatSom(totals.net)}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Oylar</p>
                <p className="mt-0.5 text-[17px] font-bold tabular-nums text-ink">
                  {totals.months} <span className="text-[12px] font-medium text-ink-muted">({totals.paid} to'langan)</span>
                </p>
              </div>
            </div>
          )}

          {/* Tarix */}
          <div className="mt-4">
            {isLoading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[72px] animate-pulse rounded-xl bg-surface-2" />
                ))}
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CloseCircle size={32} variant="Bulk" className="text-danger" />
                <p className="text-sm text-ink-muted">Tarixni yuklab bo'lmadi</p>
                <button
                  onClick={() => refetch()}
                  className="mt-1 flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-ink-soft hover:bg-surface"
                >
                  <RotateRight size={15} /> Qayta urinish
                </button>
              </div>
            ) : (data?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <WalletMoney size={36} variant="Bulk" className="text-ink-muted" />
                <p className="text-sm text-ink-soft">Hali oylik belgilanmagan</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {data!.map((s) => (
                  <li key={s.id} className="rounded-xl border border-line bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                        <Calendar size={15} variant="Bulk" className="text-ink-muted" />
                        {MONTH_NAMES[s.month - 1]} {s.year}
                      </span>
                      {s.paidAt ? (
                        <Badge tone="success" dot>To'langan</Badge>
                      ) : (
                        <Badge tone="warning" dot>Kutilmoqda</Badge>
                      )}
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div className="space-y-0.5 text-[12px] text-ink-muted">
                        <div>Asosiy: <span className="tabular-nums text-ink-soft">{formatSom(s.amount)}</span></div>
                        {s.bonus > 0 && <div>Ustama: <span className="tabular-nums text-emerald-600">+{formatSom(s.bonus)}</span></div>}
                        {s.penalty > 0 && <div>Ushlanma: <span className="tabular-nums text-red-500">−{formatSom(s.penalty)}</span></div>}
                      </div>
                      <div className="text-right">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-muted">Sof</p>
                        <p className={cn('text-[16px] font-bold tabular-nums', s.net < 0 ? 'text-red-600' : 'text-primary-600')}>
                          {formatSom(s.net)}
                        </p>
                      </div>
                    </div>
                    {s.note && (
                      <p className="mt-2 flex items-start gap-1.5 border-t border-line pt-2 text-[12px] text-ink-soft">
                        <TickCircle size={13} variant="Bulk" className="mt-0.5 shrink-0 text-ink-muted" />
                        {s.note}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
