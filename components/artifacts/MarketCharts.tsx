'use client';

/**
 * The four things a business reader wants to see about a market.
 *
 * Each one answers a question someone would actually ask out loud — who is
 * biggest, which way is it going, what did they do, who is better at what —
 * and nothing here exists because a dashboard is expected to have charts.
 *
 * Colour rule throughout: one hue per company, fixed by position so a company
 * keeps its colour between the donut, the trend and the table. A filter that
 * drops a company must never repaint the survivors.
 */

import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Banknote, Building2, Gavel, Handshake, Package, TrendingUp, UserCog,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';

/** Fixed hue order. Position in this list is identity, never rank. */
const SERIES = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'];

function cssColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  );
}

function useSeriesColors(count: number) {
  const { isDark } = useTheme();
  return useMemo(() => {
    const fallbacks = isDark
      ? ['#3987E5', '#D95926', '#199E70', '#C98500', '#D55181']
      : ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4'];
    return Array.from({ length: count }, (_, i) =>
      cssColor(SERIES[i % SERIES.length], fallbacks[i % fallbacks.length]),
    );
  }, [count, isDark]);
}

function Tip({
  active, payload, label, unit,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        color: 'var(--foreground)',
        boxShadow: 'var(--shadow-popover)',
      }}
    >
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((row) => (
        <p key={row.name} className="flex items-center gap-1.5 tabular-nums">
          <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
          <span style={{ color: 'var(--foreground-muted)' }}>{row.name}</span>
          <span className="font-medium">{row.value}{unit}</span>
        </p>
      ))}
    </div>
  );
}

function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'short', timeZone: 'UTC',
  });
}

// ── Who is biggest ──────────────────────────────────────────────────────────

/**
 * Share of the market right now.
 *
 * A donut, not a bar, because the question is "how is one whole thing divided"
 * and the slices sum to everything. "Everyone else" is always present — a share
 * chart of only the named companies quietly inflates all of them.
 */
export function MarketShareDonut({
  slices, basis,
}: {
  slices: Array<{ label: string; value: number }>;
  basis: string;
}) {
  const colors = useSeriesColors(slices.length);
  const muted = cssColor('--chart-track', '#EFF3F8');
  const data = slices.map((slice, i) => ({
    ...slice,
    fill: slice.label === 'Everyone else' ? muted : colors[i],
  }));

  return (
    <div className="veracity-card p-5 flex flex-col gap-3 min-w-0">
      <div>
        <h3 className="text-base font-semibold text-foreground">Who holds the market</h3>
        <p className="text-xs text-muted-foreground">{basis}</p>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="h-40 w-40 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="58%"
                outerRadius="100%"
                paddingAngle={2}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {data.map((slice) => (
                  <Cell key={slice.label} fill={slice.fill} />
                ))}
              </Pie>
              <Tooltip content={<Tip unit="%" />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 w-full flex flex-col gap-1.5">
          {data.map((slice) => (
            <li key={slice.label} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: slice.fill }} />
              <span className="text-foreground truncate">{slice.label}</span>
              <span className="ml-auto tabular-nums font-medium text-foreground">
                {slice.value}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Which way is it going ───────────────────────────────────────────────────

/**
 * Share over time, with the next three months projected.
 *
 * The projection is drawn dashed and its method is printed under the chart,
 * because a forecast that does not say how it was made is a guess wearing a
 * chart's clothes. Observed and projected share one axis and one colour per
 * company — the dash is the only thing that separates them, and that is enough.
 */
export function ShareTrend({
  months, companies, projection,
}: {
  months: string[];
  companies: Array<{ label: string; share: number[] }>;
  projection: { months: string[]; byCompany: Record<string, number[]>; method: string };
}) {
  const colors = useSeriesColors(companies.length);
  const grid = cssColor('--border', '#E2E8F0');
  const tick = cssColor('--foreground-muted', '#64748B');

  const data = [
    ...months.map((month, i) => {
      const row: Record<string, string | number | null> = { label: monthLabel(month) };
      companies.forEach((company) => {
        row[company.label] = company.share[i];
        // The projected line starts where the observed one ends, so the two
        // meet instead of leaving a visible gap at the join.
        row[`${company.label} projected`] =
          i === months.length - 1 ? company.share[i] : null;
      });
      return row;
    }),
    ...projection.months.map((month, i) => {
      const row: Record<string, string | number | null> = { label: monthLabel(month) };
      companies.forEach((company) => {
        row[company.label] = null;
        row[`${company.label} projected`] = projection.byCompany[company.label]?.[i] ?? null;
      });
      return row;
    }),
  ];

  return (
    <div className="veracity-card p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold text-foreground">Which way it is moving</h3>
          <p className="text-xs text-muted-foreground">
            Share of the market each month. The dashed part has not happened yet.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {companies.map((company, i) => (
            <span key={company.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-sm" style={{ background: colors[i] }} />
              {company.label}
            </span>
          ))}
        </div>
      </div>
      <div className="h-52 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={grid} strokeDasharray="2 4" />
            <XAxis
              dataKey="label" tickLine={false} axisLine={false}
              tick={{ fill: tick, fontSize: 11 }} minTickGap={12}
            />
            <YAxis
              width={32} tickLine={false} axisLine={false}
              tick={{ fill: tick, fontSize: 11 }} unit="%"
            />
            <Tooltip content={<Tip unit="%" />} />
            {companies.map((company, i) => (
              <Line
                key={company.label}
                dataKey={company.label}
                stroke={colors[i]}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
            {companies.map((company, i) => (
              <Line
                key={`${company.label}-p`}
                dataKey={`${company.label} projected`}
                stroke={colors[i]}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">
        The projection {projection.method}. It is arithmetic on what we have seen,
        not a prediction of what anyone will decide.
      </p>
    </div>
  );
}

// ── What did they actually do ───────────────────────────────────────────────

const MOVE_ICON: Record<string, typeof TrendingUp> = {
  pricing: Banknote,
  product: Package,
  funding: TrendingUp,
  leadership: UserCog,
  expansion: Building2,
  partnership: Handshake,
  regulatory: Gavel,
};

const MOVE_WORD: Record<string, string> = {
  pricing: 'Price',
  product: 'Product',
  funding: 'Money',
  leadership: 'People',
  expansion: 'Expansion',
  partnership: 'Partnership',
  regulatory: 'Rules',
};

/**
 * What each company did, newest first, with why it matters next to it.
 *
 * The "so what" line is the whole point. A dated list of announcements is a
 * news feed; a dated list where every item says what it means to you is
 * intelligence.
 */
export function DecisionTimeline({
  items, limit = 12,
}: {
  items: Array<{
    month: string; company: string; kind: string;
    headline: string; soWhat: string; sourceUrl: string;
  }>;
  limit?: number;
}) {
  const shown = items.slice(0, limit);
  return (
    <div className="veracity-card p-5 flex flex-col gap-4">
      <div>
        <h3 className="text-base font-semibold text-foreground">What they actually did</h3>
        <p className="text-xs text-muted-foreground">
          Newest first. Every line links to the page that says it.
        </p>
      </div>
      <ol className="flex flex-col">
        {shown.map((item, i) => {
          const Icon = MOVE_ICON[item.kind] ?? Package;
          return (
            <li key={`${item.month}-${item.headline}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <Icon size={13} />
                </span>
                {i < shown.length - 1 && <span className="w-px flex-1 bg-border" />}
              </div>
              <div className="pb-5 min-w-0">
                <p className="text-xs text-muted-foreground">
                  {new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
                    month: 'long', year: 'numeric', timeZone: 'UTC',
                  })}
                  {' · '}
                  <span className="text-foreground font-medium">{item.company}</span>
                  {' · '}
                  {MOVE_WORD[item.kind] ?? item.kind}
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{item.headline}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.soWhat}</p>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs text-accent hover:underline break-all"
                >
                  {item.sourceUrl.replace(/^https?:\/\//, '')}
                </a>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Who is better at what ───────────────────────────────────────────────────

export function ComparisonTable({
  companies,
}: {
  companies: Array<{
    label: string; what: string; shareNow: number; shareMove: number;
    scale: { label: string; value: string };
    strengths: string[]; watchOuts: string[];
  }>;
}) {
  const colors = useSeriesColors(companies.length);
  return (
    <div className="veracity-card p-5 flex flex-col gap-4 min-w-0">
      <div>
        <h3 className="text-base font-semibold text-foreground">Side by side</h3>
        <p className="text-xs text-muted-foreground">
          What each one is good at, and where each is exposed.
        </p>
      </div>
      <div className="overflow-x-auto">
        <div className="grid gap-3 min-w-[520px]" style={{
          gridTemplateColumns: `repeat(${companies.length}, minmax(0, 1fr))`,
        }}>
          {companies.map((company, i) => (
            <div key={company.label} className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colors[i] }} />
                  {company.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{company.what}</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {company.shareNow}%
                </p>
                <p className="text-xs text-muted-foreground">
                  of the market ·{' '}
                  <span className={
                    company.shareMove > 0
                      ? 'text-[var(--evidence-measured)]'
                      : company.shareMove < 0
                        ? 'text-[var(--evidence-unsupported)]'
                        : ''
                  }>
                    {company.shareMove > 0 ? '+' : ''}{company.shareMove} since January
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{company.scale.label}</p>
                <p className="text-sm font-medium text-foreground">{company.scale.value}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground mb-1">Good at</p>
                <ul className="flex flex-col gap-1">
                  {company.strengths.map((line) => (
                    <li key={line} className="text-xs text-muted-foreground">{line}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground mb-1">Exposed on</p>
                <ul className="flex flex-col gap-1">
                  {company.watchOuts.map((line) => (
                    <li key={line} className="text-xs text-muted-foreground">{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** How busy each company has been — the cheapest read on who is moving. */
export function ActivityByCompany({
  companies,
}: {
  companies: Array<{ label: string; moveCount: number }>;
}) {
  const colors = useSeriesColors(companies.length);
  const tick = cssColor('--foreground-muted', '#64748B');
  const data = companies.map((company, i) => ({ ...company, fill: colors[i] }));

  return (
    <div className="veracity-card p-5 flex flex-col gap-3 min-w-0">
      <div>
        <h3 className="text-base font-semibold text-foreground">Who has been busiest</h3>
        <p className="text-xs text-muted-foreground">
          Moves we recorded since January — price, product, people, money.
        </p>
      </div>
      <div className="h-32 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 2, right: 28, bottom: 2, left: 0 }}>
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis
              type="category" dataKey="label" width={110}
              tickLine={false} axisLine={false} tick={{ fill: tick, fontSize: 11 }}
            />
            <Tooltip cursor={{ fillOpacity: 0.06 }} content={<Tip unit=" moves" />} />
            <Bar
              dataKey="moveCount" name="Moves" barSize={14} radius={[0, 4, 4, 0]}
              isAnimationActive={false}
              label={{ position: 'right', fill: tick, fontSize: 11 }}
            >
              {data.map((row) => (
                <Cell key={row.label} fill={row.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
