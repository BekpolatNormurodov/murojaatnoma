import { useMemo } from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  RadialBarChart,
  RadialBar,
  PolarRadiusAxis,
  ComposedChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Legend,
} from 'recharts';
import { TrendUp, Timer1, Chart2, PercentageSquare, RotateRight } from 'iconsax-react';
import { Card, CardHeader } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatCard } from '@/shared/ui/StatCard';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { CATEGORY_META, HOME_DISTRICT } from '@/shared/data/mock';
import { formatNumber } from '@/shared/lib/format';
import {
  useCategoryDistribution,
  useHourlyActivity,
  useKpiTrend,
  useRegionStats,
  useRequestStats,
} from '@/features/dashboard/api/hooks';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-pop">
      {label && <p className="mb-1 text-xs font-semibold text-ink">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-ink">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}

function ChartError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-ink-muted">
      <span>Ma'lumotlarni yuklab bo'lmadi</span>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RotateRight size={14} /> Qayta urinish
      </Button>
    </div>
  );
}

function ChartEmpty({ text = 'Hech narsa topilmadi' }: { text?: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-ink-muted">{text}</div>;
}

export function AnalyticsPage() {
  const kpiTrendQuery = useKpiTrend();
  const categoryQuery = useCategoryDistribution();
  const regionQuery = useRegionStats();
  const hourlyQuery = useHourlyActivity();
  const requestStatsQuery = useRequestStats();

  const kpiTrend = kpiTrendQuery.data ?? [];
  const categoryDistribution = categoryQuery.data ?? [];
  // Faqat Mirzo Ulug'bek tumani (ilova bitta tuman uchun) — boshqa tumanlarsiz.
  const regionStats = (regionQuery.data ?? []).filter((r) => r.region === HOME_DISTRICT.name);
  const hourlyActivity = hourlyQuery.data ?? [];
  const requestStats = requestStatsQuery.data;

  const radarData = useMemo(
    () =>
      regionStats.map((r) => ({
        region: r.region.length > 8 ? r.region.slice(0, 8) + '…' : r.region,
        Murojaat: r.requests,
        'Hal qilingan': r.resolved,
      })),
    [regionStats],
  );

  const radialData = useMemo(
    () =>
      categoryDistribution.map((c) => ({
        name: CATEGORY_META[c.category].label,
        value: c.value,
        fill: CATEGORY_META[c.category].color,
      })),
    [categoryDistribution],
  );

  const composedData = useMemo(
    () =>
      kpiTrend.map((k) => ({
        label: k.label,
        Kelgan: k.total,
        'Hal qilingan': k.resolved,
        Foiz: k.total > 0 ? Math.round((k.resolved / k.total) * 100) : 0,
      })),
    [kpiTrend],
  );

  // Hal qilish darajasi — jonli DB agregatidan (GET /requests/stats).
  const resolutionRate =
    requestStats && requestStats.total > 0
      ? Math.round((requestStats.byStatus.resolved / requestStats.total) * 1000) / 10
      : null;

  return (
    <div>
      <PageHeader
        title="Analitika"
        subtitle="Chuqur tahlil — trendlar, taqsimotlar va samaradorlik ko'rsatkichlari"
      />

      {/* KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TrendUp} label="O'sish sur'ati" value="+18.2%" delta={18.2} tint="#10b981" index={0} />
        <StatCard
          icon={PercentageSquare}
          label="Hal qilish darajasi"
          value={
            requestStatsQuery.isLoading
              ? '—'
              : resolutionRate !== null
                ? `${resolutionRate}%`
                : '94.6%'
          }
          delta={2.4}
          tint="#3b82f6"
          index={1}
        />
        <StatCard icon={Timer1} label="O'rtacha javob vaqti" value="4.2 soat" delta={-12.5} tint="#f59e0b" index={2} />
        <StatCard icon={Chart2} label="Qoniqish indeksi" value="4.7/5" delta={3.1} tint="#a855f7" index={3} />
      </div>

      {/* Composed chart — full width */}
      <Card className="mt-5">
        <CardHeader
          title="Murojaatlar va hal qilish foizi"
          subtitle="Kelgan / hal qilingan murojaatlar va samaradorlik foizi"
        />
        <div className="h-80 p-3">
          {kpiTrendQuery.isLoading ? (
            <Skeleton className="h-full" />
          ) : kpiTrendQuery.isError ? (
            <ChartError onRetry={() => kpiTrendQuery.refetch()} />
          ) : composedData.length === 0 ? (
            <ChartEmpty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={composedData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="aKelgan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eaeef3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f6f8fb' }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area yAxisId="left" type="monotone" dataKey="Kelgan" fill="url(#aKelgan)" stroke="#3b82f6" strokeWidth={2} />
                <Bar yAxisId="left" dataKey="Hal qilingan" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={26} />
                <Line yAxisId="right" type="monotone" dataKey="Foiz" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Radar + Radial */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tumanlar bo'yicha qamrov" subtitle="Murojaat va hal qilish solishtiruvi" />
          <div className="h-80 p-3">
            {regionQuery.isLoading ? (
              <Skeleton className="h-full" />
            ) : regionQuery.isError ? (
              <ChartError onRetry={() => regionQuery.refetch()} />
            ) : radarData.length === 0 ? (
              <ChartEmpty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius={110}>
                  <PolarGrid stroke="#eaeef3" />
                  <PolarAngleAxis dataKey="region" tick={{ fill: '#64748b', fontSize: 11 }} />
                  <Radar name="Murojaat" dataKey="Murojaat" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
                  <Radar name="Hal qilingan" dataKey="Hal qilingan" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Tooltip content={<ChartTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Yo'nalishlar ulushi" subtitle="Kategoriya bo'yicha radial taqsimot" />
          <div className="h-80 p-3">
            {categoryQuery.isLoading ? (
              <Skeleton className="h-full" />
            ) : categoryQuery.isError ? (
              <ChartError onRetry={() => categoryQuery.refetch()} />
            ) : radialData.length === 0 ? (
              <ChartEmpty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  data={radialData}
                  innerRadius="25%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarRadiusAxis tick={false} axisLine={false} />
                  <RadialBar dataKey="value" cornerRadius={8} background />
                  <Legend
                    iconSize={10}
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Tooltip content={<ChartTooltip />} />
                </RadialBarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Hourly line — full width */}
      <Card className="mt-5">
        <CardHeader title="Kunlik faollik" subtitle="Soat bo'yicha murojaatlar oqimi (heatmap trend)" />
        <div className="h-64 p-3">
          {hourlyQuery.isLoading ? (
            <Skeleton className="h-full" />
          ) : hourlyQuery.isError ? (
            <ChartError onRetry={() => hourlyQuery.refetch()} />
          ) : hourlyActivity.length === 0 ? (
            <ChartEmpty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyActivity} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="hourLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eaeef3" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="value" name="Faollik" stroke="url(#hourLine)" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </div>
  );
}
