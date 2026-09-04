'use client';

/**
 * The charts the landing screen opens on.
 *
 * Home used to be four flat counters and a list, which read as a status page
 * rather than a product: it told you the current value of things but never
 * whether they were rising, falling, or flat. Every tile here therefore carries
 * its own history, and every chart plots the same already-collected monitoring
 * data the cards below summarise — nothing here triggers research or a model
 * call.
 *
 * Colour follows one rule: one hue for the measure, the status hues reserved for
 * read failures, and every series direct-labelled or legended so identity is
 * never carried by colour alone.
 */

import { useMemo } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { ArrowDownRight, ArrowUpRight, Check, Minus } from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';

export interface DailyPoint {
  date: string;
  changes: number;
  material: number;
}

/** Recharts needs concrete colours, so resolve the design tokens once. */
function cssColor(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function ChartTooltip({
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
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: row.color }}
          />
          <span style={{ color: 'var(--foreground-muted)' }}>{row.name}</span>
          <span className="font-medium">{row.value}</span>
          <span style={{ color: 'var(--foreground-muted)' }}>{unit}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * A number, what it means, which way it is moving, and its own recent shape.
 *
 * The delta is stated in plain counts rather than a percentage: going from one
 * change to two is not "a 100% rise" in any sense a reader should act on.
 */
export function KpiTile({
  label, value, detail, delta, series, tone = 'accent',
}: {
  label: string;
  value: string;
  detail: string;
  /** Change against the comparable prior period. Omit when there is nothing to compare. */
  delta?: { amount: number; period: string };
  /** Sparkline values, oldest → newest. Fewer than three points draws nothing. */
  series?: number[];
  tone?: 'accent' | 'warning';
}) {
  const stroke = tone === 'warning'
    ? 'var(--evidence-derived)'
    : 'var(--accent)';
  const points = (series ?? []).map((v, i) => ({ i, v }));
  const flat = points.every((p) => p.v === 0);

  const Trend = !delta || delta.amount === 0
    ? Minus
    : delta.amount > 0 ? ArrowUpRight : ArrowDownRight;
  const trendColor = !delta || delta.amount === 0
    ? 'text-muted-foreground'
    : delta.amount > 0
      ? 'text-[var(--evidence-derived)]'
      : 'text-[var(--evidence-measured)]';

  return (
    <div className="veracity-card p-4 sm:p-5 flex flex-col gap-1 overflow-hidden">
      <p className="ui-section-label text-muted-foreground">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold text-foreground tabular-nums">{value}</p>
        {points.length >= 3 && !flat && (
          <div className="h-8 w-20 shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={stroke}
                  strokeWidth={2}
                  fill={stroke}
                  fillOpacity={0.12}
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {delta ? (
        <p className={`flex items-center gap-1 text-xs tabular-nums ${trendColor}`}>
          <Trend size={13} />
          {delta.amount === 0
            ? `No change ${delta.period}`
            : `${delta.amount > 0 ? '+' : ''}${delta.amount} ${delta.period}`}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{detail}</p>
      )}
      {delta && <p className="text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

/**
 * Changes observed per day, split by whether they cleared the user's
 * materiality threshold. Two series, so both are legended and the axis is
 * shared — the whole point is that the shaded part is a subset of the bar.
 */
export function ActivityChart({ daily }: { daily: DailyPoint[] }) {
  const { isDark } = useTheme();
  const colors = useMemo(() => ({
    material: cssColor('--chart-1', '#2A78D6'),
    other: cssColor('--chart-track', isDark ? '#1E293B' : '#EFF3F8'),
    grid: cssColor('--border', '#E2E8F0'),
    tick: cssColor('--foreground-muted', '#64748B'),
  }), [isDark]);

  const data = daily.map((point) => ({
    label: new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
    }),
    material: point.material,
    other: Math.max(0, point.changes - point.material),
  }));
  const empty = data.every((d) => d.material === 0 && d.other === 0);

  return (
    <div className="veracity-card p-5 flex flex-col gap-3 min-w-0">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-foreground">Change activity</h2>
          <p className="text-xs text-muted-foreground">
            {daily.length === 0
              ? 'Reading each company’s history…'
              : `Changes we detected each day, last ${daily.length} days.`}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: colors.material }} />
            Worth attention
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-sm border border-border"
              style={{ background: colors.other }}
            />
            Below your threshold
          </span>
        </div>
      </div>

      {empty ? (
        <EmptyPlot note="No changes detected in this window yet." />
      ) : (
        <div className="h-44 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={0}>
              <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="2 4" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
                tick={{ fill: colors.tick, fontSize: 11 }}
              />
              <YAxis
                allowDecimals={false}
                width={28}
                tickLine={false}
                axisLine={false}
                tick={{ fill: colors.tick, fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: colors.grid, fillOpacity: 0.35 }}
                content={<ChartTooltip unit="changes" />}
              />
              <Bar
                dataKey="other"
                name="Below your threshold"
                stackId="a"
                fill={colors.other}
                isAnimationActive={false}
              />
              <Bar
                dataKey="material"
                name="Worth attention"
                stackId="a"
                fill={colors.material}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  pricing_changed: 'Pricing',
  feature_launched: 'Feature launched',
  feature_removed: 'Feature removed',
  positioning_changed: 'Positioning',
  segment_changed: 'Target segment',
  integration_announced: 'Integration',
  hiring_signal: 'Hiring',
  funding_or_filing: 'Funding / filing',
  review_theme: 'Review themes',
  documentation_changed: 'Documentation',
};

/**
 * What kind of thing is moving. One measure across categories, so the bars are
 * one hue with the value direct-labelled — a rank has no meaning as colour.
 */
export function TypeBreakdown({ byType }: { byType: Array<{ type: string; count: number }> }) {
  const { isDark } = useTheme();
  // Re-resolve on theme change: the tokens are read off the DOM, so the values
  // are stale after a toggle even though the call sites do not name the theme.
  const colors = useMemo(() => ({
    bar: cssColor('--chart-1', isDark ? '#3987E5' : '#2A78D6'),
    tick: cssColor('--foreground-muted', '#64748B'),
  }), [isDark]);

  const data = byType.slice(0, 6).map((row) => ({
    label: TYPE_LABEL[row.type] ?? row.type.replace(/_/g, ' '),
    count: row.count,
  }));

  return (
    <div className="veracity-card p-5 flex flex-col gap-3 min-w-0">
      <div>
        <h2 className="text-base font-semibold text-foreground">What is changing</h2>
        <p className="text-xs text-muted-foreground">
          Every change we have on record, grouped by what moved.
        </p>
      </div>
      {data.length === 0 ? (
        <EmptyPlot note="Nothing on record to group yet." />
      ) : (
        <div className="h-44 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 2, right: 24, bottom: 2, left: 0 }}
            >
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="label"
                width={110}
                tickLine={false}
                axisLine={false}
                tick={{ fill: colors.tick, fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: colors.bar, fillOpacity: 0.08 }}
                content={<ChartTooltip unit="on record" />}
              />
              <Bar
                dataKey="count"
                name="Changes"
                fill={colors.bar}
                radius={[0, 4, 4, 0]}
                barSize={14}
                isAnimationActive={false}
                label={{ position: 'right', fill: colors.tick, fontSize: 11 }}
              >
                {data.map((row) => (
                  <Cell key={row.label} fill={colors.bar} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/**
 * Coverage: of the sources we watch, how many failed to answer.
 *
 * A full-width green bar reading 100% is decoration — it draws the eye to the
 * one thing that needs no attention. So when every source answered this is a
 * single line of text, and the bar only appears once there is a failure to show
 * a proportion of. Failures wear the status hue *and* the word, never colour
 * alone.
 */
export function CoverageBar({ total, failed }: { total: number; failed: number }) {
  // `failed` is a subset of `total` — the API counts every distinct source it
  // watches, then flags the ones whose last fetch did not succeed.
  const answered = Math.max(0, total - failed);

  if (failed === 0) {
    return (
      <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <Check size={14} className="text-[var(--evidence-measured)]" />
        {total === 0
          ? 'No pages read yet.'
          : `All ${total} sources answered on the last run.`}
      </p>
    );
  }

  return (
    <div className="veracity-card p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {failed} source{failed === 1 ? '' : 's'} could not be read
          </h2>
          <p className="text-xs text-muted-foreground">
            We could not look at {failed === 1 ? 'it' : 'them'} on the last run, so
            nothing there is being compared. {answered} of {total} answered.
          </p>
        </div>
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {Math.round((answered / total) * 100)}%
        </span>
      </div>
      <div
        className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full"
        style={{ background: 'var(--chart-track)' }}
        role="img"
        aria-label={`${answered} of ${total} sources answered`}
      >
        <span
          style={{
            width: `${(answered / total) * 100}%`,
            background: 'var(--evidence-measured)',
          }}
        />
        <span
          style={{
            width: `${(failed / total) * 100}%`,
            background: 'var(--evidence-unsupported)',
          }}
        />
      </div>
    </div>
  );
}

function EmptyPlot({ note }: { note: string }) {
  return (
    <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-border">
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
