import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  MessageQuestion,
  TickCircle,
  Clock,
  Profile2User,
  ArrowRight,
  CalendarTick,
  Video,
  WalletMoney,
  MoneyRecive,
  EmptyWallet,
  Cpu,
  ShieldTick,
  Location,
  Speaker,
} from 'iconsax-react';
import { StatCard } from '@/shared/ui/StatCard';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Progress } from '@/shared/ui/Progress';
import { PageHeader } from '@/shared/ui/PageHeader';
import {
  CATEGORY_DISTRIBUTION,
  CATEGORY_META,
  DISTRICT_LOADS,
  KPI_TREND,
  LOAD_COLOR,
  LOAD_LABEL,
  NEWS,
  NEWS_META,
  REGION_STATS,
  REQUESTS,
  STATUS_META,
  SUMMARY,
  WORKERS,
} from '@/shared/data/mock';
import { formatNumber, formatSomShort, timeAgo } from '@/shared/lib/format';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-pop">
      <p className="mb-1 text-xs font-semibold text-ink">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-ink">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const recent = REQUESTS.slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Boshqaruv paneli"
        subtitle="Umumiy ko'rsatkichlar va real vaqtdagi faollik"
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={MessageQuestion}
          label="Jami murojaatlar"
          value={formatNumber(SUMMARY.totalRequests)}
          delta={12.4}
          tint="#3b82f6"
          index={0}
        />
        <StatCard
          icon={TickCircle}
          label="Hal qilingan"
          value={formatNumber(SUMMARY.resolved)}
          delta={8.1}
          tint="#10b981"
          index={1}
        />
        <StatCard
          icon={Clock}
          label="Jarayonda"
          value={formatNumber(SUMMARY.inProgress)}
          delta={-3.2}
          tint="#f59e0b"
          index={2}
        />
        <StatCard
          icon={Profile2User}
          label="Faol ishchilar"
          value={formatNumber(SUMMARY.activeWorkers)}
          delta={5.6}
          tint="#a855f7"
          index={3}
        />
      </div>

      {/* Secondary KPI row */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarTick}
          label="Davomat darajasi"
          value={`${SUMMARY.avgAttendance}%`}
          delta={2.3}
          tint="#0ea5e9"
          index={4}
        />
        <StatCard
          icon={Video}
          label="Faol kameralar"
          value={`${SUMMARY.camerasOnline}/${SUMMARY.camerasTotal}`}
          delta={1.1}
          tint="#6366f1"
          index={5}
        />
        <StatCard
          icon={WalletMoney}
          label="Kommunal yig'ish"
          value={`${SUMMARY.collectionRate}%`}
          delta={1.8}
          tint="#10b981"
          index={6}
        />
        <StatCard
          icon={MoneyRecive}
          label="Yillik aylanma"
          value={formatSomShort(SUMMARY.turnover)}
          delta={9.8}
          tint="#f59e0b"
          index={7}
        />
      </div>

      {/* Main charts row */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Trend area chart */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Murojaatlar dinamikasi"
            subtitle="Oylik kelgan va hal qilingan murojaatlar"
            action={
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-ink-soft">
                  <span className="h-2.5 w-2.5 rounded-full bg-accent-500" /> Kelgan
                </span>
                <span className="flex items-center gap-1.5 text-ink-soft">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary-500" /> Hal qilingan
                </span>
              </div>
            }
          />
          <div className="h-72 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={KPI_TREND} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eaeef3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Kelgan"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#gTotal)"
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  name="Hal qilingan"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#gResolved)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Category donut */}
        <Card>
          <CardHeader title="Yo'nalishlar" subtitle="Kategoriya bo'yicha taqsimot" />
          <div className="h-52 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={CATEGORY_DISTRIBUTION}
                  dataKey="value"
                  nameKey="category"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="none"
                >
                  {CATEGORY_DISTRIBUTION.map((slice) => (
                    <Cell key={slice.category} fill={CATEGORY_META[slice.category].color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 px-5 pb-5">
            {CATEGORY_DISTRIBUTION.map((slice) => (
              <div key={slice.category} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: CATEGORY_META[slice.category].color }}
                />
                <span className="text-ink-soft">{CATEGORY_META[slice.category].label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Operational widgets: attendance · cameras · finance */}
      <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Attendance */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info-soft text-accent-600">
                <CalendarTick size={19} variant="Bulk" />
              </span>
              <h3 className="text-[15px] font-semibold text-ink">Davomat holati</h3>
            </div>
            <Link to="/attendance" className="text-primary-600 hover:text-primary-700">
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="mt-4 space-y-3.5">
            <WidgetRow
              icon={<TickCircle size={16} variant="Bulk" className="text-primary-500" />}
              label="Bugun ishga keldi"
              value={`${SUMMARY.checkedInToday}/${WORKERS.length}`}
            />
            <WidgetRow
              icon={<ShieldTick size={16} variant="Bulk" className="text-accent-500" />}
              label="O'zini tasdiqladi"
              value={`${SUMMARY.confirmedToday}/${WORKERS.length}`}
            />
            <WidgetRow
              icon={<Location size={16} variant="Bulk" className="text-amber-500" />}
              label="Hududida"
              value={`${SUMMARY.insideRegion}/${WORKERS.length}`}
            />
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">O'rtacha davomat</span>
                <span className="font-semibold text-ink">{SUMMARY.avgAttendance}%</span>
              </div>
              <Progress value={SUMMARY.avgAttendance} height={7} color="#0ea5e9" />
            </div>
          </div>
        </Card>

        {/* Cameras */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-600">
                <Video size={19} variant="Bulk" />
              </span>
              <h3 className="text-[15px] font-semibold text-ink">Video kuzatuv</h3>
            </div>
            <Link to="/cameras" className="text-primary-600 hover:text-primary-700">
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <span className="text-3xl font-bold text-ink">{SUMMARY.camerasOnline}</span>
            <span className="pb-1 text-sm text-ink-muted">/ {SUMMARY.camerasTotal} faol</span>
          </div>
          <Progress
            value={(SUMMARY.camerasOnline / SUMMARY.camerasTotal) * 100}
            height={7}
            color="#6366f1"
            className="mt-2"
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Cpu size={13} variant="Bulk" /> Aniqlangan (24s)
              </div>
              <div className="mt-1 text-lg font-bold text-ink">{formatNumber(SUMMARY.detections24h)}</div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Video size={13} variant="Bulk" /> O'chgan
              </div>
              <div className="mt-1 text-lg font-bold text-red-500">
                {SUMMARY.camerasTotal - SUMMARY.camerasOnline}
              </div>
            </div>
          </div>
        </Card>

        {/* Finance */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-soft text-primary-600">
                <WalletMoney size={19} variant="Bulk" />
              </span>
              <h3 className="text-[15px] font-semibold text-ink">Kommunal to'lovlar</h3>
            </div>
            <Link to="/finance" className="text-primary-600 hover:text-primary-700">
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="mt-4 space-y-3.5">
            <WidgetRow
              icon={<MoneyRecive size={16} variant="Bulk" className="text-primary-500" />}
              label="Yig'ilgan"
              value={formatSomShort(SUMMARY.utilityCollected)}
            />
            <WidgetRow
              icon={<WalletMoney size={16} variant="Bulk" className="text-accent-500" />}
              label="Hisoblangan"
              value={formatSomShort(SUMMARY.utilityCharged)}
            />
            <WidgetRow
              icon={<EmptyWallet size={16} variant="Bulk" className="text-red-500" />}
              label="Qarzdorlik"
              value={formatSomShort(SUMMARY.utilityDebt)}
            />
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[13px]">
                <span className="text-ink-soft">Yig'ish darajasi</span>
                <span className="font-semibold text-ink">{SUMMARY.collectionRate}%</span>
              </div>
              <Progress value={SUMMARY.collectionRate} height={7} color="#10b981" />
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom row: regions bar + recent requests */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="Tumanlar kesimi" subtitle="Murojaatlar soni" />
          <div className="h-72 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={REGION_STATS} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eaeef3" vertical={false} />
                <XAxis
                  dataKey="region"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f6f8fb' }} />
                <Bar dataKey="requests" name="Murojaat" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="resolved" name="Hal qilingan" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent requests */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="So'nggi murojaatlar"
            subtitle="Eng yangi kelgan murojaatlar"
            action={
              <button className="flex items-center gap-1 text-[13px] font-medium text-primary-600 hover:underline">
                Barchasi <ArrowRight size={15} />
              </button>
            }
          />
          <div className="p-3">
            {recent.map((r, i) => {
              const worker = WORKERS.find((w) => w.id === r.assignedWorkerId);
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold"
                    style={{
                      background: `${CATEGORY_META[r.category].color}1a`,
                      color: CATEGORY_META[r.category].color,
                    }}
                  >
                    {CATEGORY_META[r.category].label[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{r.title}</p>
                    <p className="text-xs text-ink-muted">
                      {r.region} · {r.citizenName}
                    </p>
                  </div>
                  {worker && (
                    <Avatar name={worker.name} color={worker.avatarColor} size={28} />
                  )}
                  <Badge tone={STATUS_META[r.status].tone} dot>
                    {STATUS_META[r.status].label}
                  </Badge>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* District load overview */}
      <Card className="mt-5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Tumanlar yuklamasi</h3>
            <p className="mt-0.5 text-xs text-ink-muted">Ochiq murojaatlar bo'yicha hudud holati</p>
          </div>
          <Link
            to="/map"
            className="flex items-center gap-1 text-[13px] font-medium text-primary-600 hover:underline"
          >
            Xaritada <ArrowRight size={15} />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {DISTRICT_LOADS.map((d, i) => (
            <motion.div
              key={d.district.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.4) }}
              className="rounded-xl border border-line bg-surface p-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="truncate text-[13px] font-semibold text-ink">{d.district.name}</span>
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: LOAD_COLOR[d.load] }}
                />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-ink">{d.requests}</span>
                <span className="text-[11px] text-ink-muted">murojaat</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-ink-muted">
                <span>{d.workers} xodim · {d.cameras} kamera</span>
              </div>
              <span
                className="mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-medium"
                style={{ background: `${LOAD_COLOR[d.load]}1a`, color: LOAD_COLOR[d.load] }}
              >
                {LOAD_LABEL[d.load]}
              </span>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Latest news */}
      <Card className="mt-5 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Speaker size={18} variant="Bulk" className="text-primary-600" />
              So'nggi yangiliklar
            </h3>
            <p className="mt-0.5 text-xs text-ink-muted">Tuman hokimiyati rasmiy e'lonlari</p>
          </div>
          <Link
            to="/news"
            className="flex items-center gap-1 text-[13px] font-medium text-primary-600 hover:underline"
          >
            Barchasi <ArrowRight size={15} />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {NEWS.filter((n) => n.status === 'published')
            .slice(0, 4)
            .map((n, i) => {
              const meta = NEWS_META[n.category];
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                >
                  <Link
                    to="/news"
                    className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:shadow-pop"
                  >
                    <div className="relative h-28 overflow-hidden">
                      <img
                        src={n.cover}
                        alt={n.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <span
                        className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ background: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <p className="text-[13px] font-semibold leading-snug text-ink line-clamp-2 transition-colors group-hover:text-primary-600">
                        {n.title}
                      </p>
                      <span className="mt-auto pt-2 text-[11px] text-ink-muted">
                        {timeAgo(n.publishedAt)}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
        </div>
      </Card>
    </div>
  );
}

function WidgetRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-[13px] text-ink-soft">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}
