import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  WalletMoney,
  MoneyRecive,
  EmptyWallet,
  PercentageSquare,
  ReceiptItem,
  Building3,
  Drop,
  Flash,
  GasStation,
  Sun1,
  Trash,
  Wifi,
  type Icon as IconType,
} from 'iconsax-react';
import { Card, CardHeader } from '@/shared/ui/Card';
import { StatCard } from '@/shared/ui/StatCard';
import { Progress } from '@/shared/ui/Progress';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Select } from '@/shared/ui/Select';
import {
  DISTRICTS,
  FINANCE_MONTHLY,
  SUMMARY,
  UTILITY_META,
  UTILITY_MONTHLY,
  UTILITY_PAYMENTS,
} from '@/shared/data/mock';
import type { UtilityType } from '@/shared/data/types';
import { formatShort, formatSomShort } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

const UTIL_ICON: Record<UtilityType, IconType> = {
  suv: Drop,
  gaz: GasStation,
  elektr: Flash,
  issiqlik: Sun1,
  tozalik: Trash,
  internet: Wifi,
};

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-pop">
      <p className="mb-1 text-xs font-semibold text-ink">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-ink">{formatSomShort(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function FinancePage() {
  const [type, setType] = useState<UtilityType | 'all'>('all');

  const lastBudget = FINANCE_MONTHLY[FINANCE_MONTHLY.length - 1].budget;

  const byDistrict = useMemo(
    () =>
      DISTRICTS.map((d) => {
        const rows = UTILITY_PAYMENTS.filter(
          (u) => u.districtId === d.id && (type === 'all' || u.type === type),
        );
        const charged = rows.reduce((s, r) => s + r.charged, 0);
        const collected = rows.reduce((s, r) => s + r.collected, 0);
        const debt = rows.reduce((s, r) => s + r.debt, 0);
        return {
          id: d.id,
          name: d.name,
          households: d.households,
          charged,
          collected,
          debt,
          rate: charged > 0 ? Math.round((collected / charged) * 1000) / 10 : 0,
        };
      }),
    [type],
  );

  const byType = useMemo(
    () =>
      (Object.keys(UTILITY_META) as UtilityType[]).map((t) => {
        const rows = UTILITY_PAYMENTS.filter((u) => u.type === t);
        return {
          type: t,
          label: UTILITY_META[t].label,
          color: UTILITY_META[t].color,
          charged: rows.reduce((s, r) => s + r.charged, 0),
          collected: rows.reduce((s, r) => s + r.collected, 0),
          debt: rows.reduce((s, r) => s + r.debt, 0),
        };
      }),
    [],
  );

  const collectionByDistrict = [...byDistrict]
    .filter((d) => d.charged > 0)
    .sort((a, b) => b.rate - a.rate);

  const topDebtors = [...byDistrict].sort((a, b) => b.debt - a.debt).slice(0, 5);

  const financeData = FINANCE_MONTHLY.map((f) => ({
    label: f.month,
    Aylanma: f.turnover,
    Byudjet: f.budget,
    Sarflangan: f.spent,
  }));

  const donutTotal = byType.reduce((s, t) => s + t.charged, 0);

  return (
    <div>
      <PageHeader
        title="Moliya va kommunal"
        subtitle="Kommunal to'lovlar hisoboti, yig'ish darajasi, qarzdorlik va aylanma"
        action={
          <button className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-glow hover:bg-primary-700">
            <ReceiptItem size={18} variant="Bulk" /> Hisobotni yuklash
          </button>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={WalletMoney} label="Yillik aylanma" value={formatSomShort(SUMMARY.turnover)} delta={9.8} tint="#10b981" index={0} />
        <StatCard icon={ReceiptItem} label="Hisoblangan (oy)" value={formatSomShort(SUMMARY.utilityCharged)} delta={4.2} tint="#3b82f6" index={1} />
        <StatCard icon={MoneyRecive} label="Yig'ilgan" value={formatSomShort(SUMMARY.utilityCollected)} delta={6.1} tint="#06b6d4" index={2} />
        <StatCard icon={PercentageSquare} label="Yig'ish darajasi" value={`${SUMMARY.collectionRate}%`} delta={1.8} tint="#a855f7" index={3} />
        <StatCard icon={EmptyWallet} label="Umumiy qarz" value={formatSomShort(SUMMARY.utilityDebt)} delta={-3.4} tint="#ef4444" index={4} />
        <StatCard icon={Building3} label="Oylik byudjet" value={formatSomShort(lastBudget)} delta={2.5} tint="#f59e0b" index={5} />
      </div>

      {/* Turnover composed */}
      <Card className="mt-5">
        <CardHeader title="Aylanma dinamikasi" subtitle="Byudjet, sarflangan mablag' va umumiy aylanma (12 oy)" />
        <div className="h-80 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={financeData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gTurnover" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eaeef3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatShort(v)}
                width={56}
              />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#f6f8fb' }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area type="monotone" dataKey="Aylanma" stroke="#10b981" strokeWidth={2.5} fill="url(#gTurnover)" />
              <Bar dataKey="Byudjet" fill="#c7d2fe" radius={[5, 5, 0, 0]} maxBarSize={22} />
              <Bar dataKey="Sarflangan" fill="#6366f1" radius={[5, 5, 0, 0]} maxBarSize={22} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Utility monthly + donut */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Kommunal to'lovlar tarkibi" subtitle="Tur bo'yicha oylik yig'ilgan summalar" />
          <div className="h-72 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={UTILITY_MONTHLY} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eaeef3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatShort(v)}
                  width={52}
                />
                <Tooltip content={<MoneyTooltip />} />
                {(Object.keys(UTILITY_META) as UtilityType[]).map((t) => (
                  <Area
                    key={t}
                    type="monotone"
                    dataKey={t}
                    name={UTILITY_META[t].label}
                    stackId="1"
                    stroke={UTILITY_META[t].color}
                    fill={UTILITY_META[t].color}
                    fillOpacity={0.7}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Tur bo'yicha ulush" subtitle="Hisoblangan summa taqsimoti" />
          <div className="relative h-52 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byType} dataKey="charged" nameKey="label" innerRadius={52} outerRadius={80} paddingAngle={3} stroke="none">
                  {byType.map((t) => (
                    <Cell key={t.type} fill={t.color} />
                  ))}
                </Pie>
                <Tooltip content={<MoneyTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-ink">{formatShort(donutTotal)}</span>
              <span className="text-[11px] text-ink-muted">jami</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 px-5 pb-5">
            {byType.map((t) => {
              const Ic = UTIL_ICON[t.type];
              return (
                <div key={t.type} className="flex items-center gap-2 text-xs">
                  <Ic size={15} variant="Bulk" style={{ color: t.color }} />
                  <span className="text-ink-soft">{t.label}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Collection rate by district + top debtors */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-[15px] font-semibold text-ink">Tuman bo'yicha yig'ish darajasi</h3>
          <p className="mt-0.5 text-xs text-ink-muted">Kommunal to'lovlar yig'ilishi (%)</p>
          <div className="mt-4 space-y-3">
            {collectionByDistrict.map((d) => (
              <div key={d.id}>
                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="font-medium text-ink">{d.name}</span>
                  <span className="font-semibold text-ink-soft">{d.rate}%</span>
                </div>
                <Progress
                  value={d.rate}
                  height={7}
                  color={d.rate >= 95 ? '#10b981' : d.rate >= 90 ? '#3b82f6' : '#f59e0b'}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-[15px] font-semibold text-ink">Eng yuqori qarzdorlik</h3>
          <p className="mt-0.5 text-xs text-ink-muted">Qarz miqdori bo'yicha top tumanlar</p>
          <div className="mt-4 space-y-2.5">
            {topDebtors.map((d, i) => (
              <div
                key={d.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-danger-soft text-sm font-bold text-red-600">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-ink">{d.name}</div>
                  <div className="text-[11px] text-ink-muted">{formatShort(d.households)} xonadon</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-red-600">{formatSomShort(d.debt)}</div>
                  <div className="text-[11px] text-ink-muted">{d.rate}% yig'ildi</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Detailed table */}
      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title="Kommunal to'lovlar hisoboti"
          subtitle="2026-yil May oyi · tuman kesimida"
          action={
            <Select
              size="sm"
              menuAlign="end"
              value={type}
              onChange={(v) => setType(v as UtilityType | 'all')}
              options={[
                { value: 'all', label: 'Barcha turlar' },
                ...(Object.keys(UTILITY_META) as UtilityType[]).map((t) => ({
                  value: t,
                  label: UTILITY_META[t].label,
                  dot: UTILITY_META[t].color,
                })),
              ]}
            />
          }
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-180 text-left text-sm">
            <thead>
              <tr className="border-y border-line text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="px-5 py-3 font-semibold">Tuman</th>
                <th className="px-3 py-3 font-semibold">Xonadon</th>
                <th className="px-3 py-3 font-semibold">Hisoblangan</th>
                <th className="px-3 py-3 font-semibold">Yig'ilgan</th>
                <th className="px-3 py-3 font-semibold">Qarz</th>
                <th className="px-5 py-3 font-semibold">Yig'ish %</th>
              </tr>
            </thead>
            <tbody>
              {byDistrict.map((d, i) => (
                <motion.tr
                  key={d.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="border-b border-line/70 transition-colors hover:bg-surface-2"
                >
                  <td className="px-5 py-3 font-medium text-ink">{d.name}</td>
                  <td className="px-3 py-3 text-ink-soft">{formatShort(d.households)}</td>
                  <td className="px-3 py-3 text-ink-soft">{formatSomShort(d.charged)}</td>
                  <td className="px-3 py-3 font-medium text-primary-600">{formatSomShort(d.collected)}</td>
                  <td className="px-3 py-3 font-medium text-red-500">{formatSomShort(d.debt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={d.rate}
                        height={6}
                        className="w-20"
                        color={d.rate >= 95 ? '#10b981' : d.rate >= 90 ? '#3b82f6' : '#f59e0b'}
                      />
                      <span
                        className={cn(
                          'text-[12px] font-semibold',
                          d.rate >= 95 ? 'text-primary-600' : d.rate >= 90 ? 'text-accent-600' : 'text-amber-600',
                        )}
                      >
                        {d.rate}%
                      </span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
