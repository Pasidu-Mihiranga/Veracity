'use client';

/**
 * "Market at a glance" — the visual summary the Home screen opens on.
 *
 * Three things, in order of how a decision-maker reads them:
 *   1. a KPI strip (reuses the existing KpiTile) — the numbers, each with its
 *      own recent shape so you see direction, not just level;
 *   2. Market Momentum — share of voice per tracked company over 12 weeks, the
 *      "where is this heading" chart;
 *   3. Share of Voice — who holds the attention right now, as a donut.
 *
 * All mock data (see lib/mock/home-charts.ts). Colour follows the house rule
 * from HomeCharts: series are direct-labelled or legended so identity never
 * rides on colour alone, and the tokens are resolved off the DOM so a theme
 * toggle re-colours everything. Cards rise in on mount (framer-motion) and the
 * charts draw themselves in (Recharts) — the two never fight because one moves
 * the container and the other moves the marks.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell,
} from 'recharts';
import { useTheme } from '@/lib/theme-provider';
import { KpiTile } from '@/components/dashboard/HomeCharts';
import {
  HOME_KPIS, MOMENTUM_SERIES, SHARE_OF_VOICE, TRACKED_COMPANIES,
  type HomeKpi, type MomentumPoint,
} from '@/lib/mock/home-charts';

/** Recharts needs concrete colours, so resolve the design tokens once. */
function cssColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** Shared rise-in for every card in the section, staggered by index. */
const rise = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] as const },
});

function MomentumTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-sm"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        color: 'var(--foreground)',
      }}
    >
      <p className="font-medium mb-1">{label}</p>
      {payload.map((row) => (
        <p key={row.name} className="flex items-center gap-1.5 tabular-nums">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: row.color }} />
          <span style={{ color: 'var(--foreground-muted)' }}>{row.name}</span>
          <span className="font-medium">{row.value}%</span>
        </p>
      ))}
    </div>
  );
}

function MarketMomentum({
  series,
  companies,
}: {
  series: MomentumPoint[];
  companies: Array<{ key: string; label: string; colorVar: string; fallback: string }>;
}) {
  const { isDark } = useTheme();
  const colors = useMemo(() => ({
    grid: cssColor('--border', '#E2E8F0'),
    tick: cssColor('--foreground-muted', '#64748B'),
    series: companies.map((c) => cssColor(c.colorVar, c.fallback)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isDark, companies]);

  return (
    <div className="veracity-card p-5 flex flex-col gap-3 min-w-0 w-full">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-foreground">Market momentum</h2>
          <p className="text-xs text-muted-foreground">
            Share of voice across search, news &amp; social — last 12 weeks.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {companies.map((c, i) => (
            <span key={c.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: colors.series[i] }} />
              {c.label}
            </span>
          ))}
        </div>
      </div>

      <div className="h-56 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {companies.map((c, i) => (
                <linearGradient key={c.key} id={`mom-${c.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.series[i]} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={colors.series[i]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="2 4" />
            <XAxis
              dataKey="week"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={20}
              tick={{ fill: colors.tick, fontSize: 11 }}
            />
            <YAxis
              width={32}
              domain={[0, 50]}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.tick, fontSize: 11 }}
            />
            <Tooltip content={<MomentumTooltip />} />
            {companies.map((c, i) => (
              <Area
                key={c.key}
                type="monotone"
                dataKey={c.key}
                name={c.label}
                stroke={colors.series[i]}
                strokeWidth={2}
                fill={`url(#mom-${c.key})`}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                isAnimationActive
                animationBegin={200 + i * 180}
                animationDuration={900}
                animationEasing="ease-out"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ShareOfVoice({
  shareOfVoice,
  companies,
}: {
  shareOfVoice: Array<{ key: string; label: string; value: number }>;
  companies: Array<{ key: string; label: string; colorVar: string; fallback: string }>;
}) {
  const { isDark } = useTheme();
  const colors = useMemo(
    () => companies.map((c) => cssColor(c.colorVar, c.fallback)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDark, companies],
  );
  const leader = shareOfVoice.reduce((a, b) => (b.value > a.value ? b : a), shareOfVoice[0] || { label: 'Tracked', value: 0 });

  return (
    <div className="veracity-card p-5 flex flex-col gap-3 min-w-0 w-full">
      <div>
        <h2 className="text-base font-semibold text-foreground">Share of voice</h2>
        <p className="text-xs text-muted-foreground">Who holds the attention right now.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative h-40 w-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={shareOfVoice}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={2}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                isAnimationActive
                animationBegin={250}
                animationDuration={900}
                animationEasing="ease-out"
              >
                {shareOfVoice.map((_, i) => (
                  <Cell key={i} fill={colors[i] || '#2A78D6'} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, n) => [`${v}%`, n as string]}
                contentStyle={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: 'var(--foreground)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold text-foreground tabular-nums">{leader.value}%</span>
            <span className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
              {leader.label.split(' ')[0]}
            </span>
          </div>
        </div>

        <ul className="flex flex-col gap-2 min-w-0 flex-1">
          {shareOfVoice.map((row, i) => (
            <li key={row.key} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: colors[i] || '#2A78D6' }} />
              <span className="truncate text-foreground">{row.label}</span>
              <span className="ml-auto font-semibold tabular-nums text-muted-foreground">
                {row.value}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function HomeInsightCharts() {
  const [kpis, setKpis] = useState<HomeKpi[]>([]);
  const [momentumSeries, setMomentumSeries] = useState<MomentumPoint[]>([]);
  const [shareOfVoice, setShareOfVoice] = useState<Array<{ key: any; label: string; value: number }>>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/market/kpis', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        const data = payload?.data ?? payload;
        if (Array.isArray(data?.kpis) && data.kpis.length > 0) {
          setKpis(data.kpis);
        } else {
          setKpis([]);
        }
        if (Array.isArray(data?.momentumSeries)) setMomentumSeries(data.momentumSeries);
        if (Array.isArray(data?.shareOfVoice)) setShareOfVoice(data.shareOfVoice);
        if (Array.isArray(data?.companies)) setCompanies(data.companies);
      })
      .catch(() => {
        setKpis([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            Market at a glance
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl skeleton" />
          ))}
        </div>
      </section>
    );
  }

  if (companies.length === 0 || kpis.length === 0) {
    return (
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
            Market at a glance
          </h2>
          <span className="text-xs text-muted-foreground">Live Intelligence Metrics</span>
        </div>
        <div
          className="rounded-2xl p-5 sm:p-6 bg-card border border-border shadow-sm flex flex-col items-center justify-center text-center gap-2"
          style={{ boxShadow: 'var(--shadow-extruded)' }}
        >
          <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-1">
            <TrendingUp size={20} />
          </div>
          <h3 className="text-sm font-bold text-foreground">No market telemetry yet</h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Once you track competitors or launch research, live momentum trends, category share of voice, and source health metrics will automatically generate here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground">
          Market at a glance
        </h2>
        <span className="text-xs text-muted-foreground">Across your tracked companies</span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.id} {...rise(i)}>
            <KpiTile
              label={kpi.label}
              value={kpi.value}
              detail={kpi.detail}
              delta={kpi.delta}
              series={kpi.series}
              tone={kpi.tone}
            />
          </motion.div>
        ))}
      </div>

      {/* Momentum + Share of voice */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <motion.div className="lg:col-span-3 flex" {...rise(4)}>
          <MarketMomentum series={momentumSeries} companies={companies} />
        </motion.div>
        <motion.div className="lg:col-span-2 flex" {...rise(5)}>
          <ShareOfVoice shareOfVoice={shareOfVoice} companies={companies} />
        </motion.div>
      </div>
    </section>
  );
}

