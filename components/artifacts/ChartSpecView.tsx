'use client';

import React, { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { Download, Info } from 'lucide-react';
import type { ChartSpec } from '@/lib/intelligence/types';
import { downloadCsv, rowsToCsv } from '@/lib/csv-download';
import { useTheme } from '@/lib/theme-provider';

/**
 * Renders a validated ChartSpec.
 *
 * One component for every decision chart, so the methodology contract cannot be
 * satisfied on some artifacts and quietly skipped on others: data class, unit,
 * period, sample size, formula, sources, and a CSV of the exact rows are
 * structural here rather than per-chart decisions.
 *
 * Null cells stay null. Recharts renders them as gaps, which is the correct
 * picture — a missing observation is not a zero.
 */

export interface ChartSpecViewProps {
  spec: ChartSpec;
  /** Reasons the chart could not be built. When present, the empty state renders instead. */
  unavailableReasons?: string[];
  onOpenEvidence?: (spanIds: string[]) => void;
}

const SERIES_COLORS = ['#0052FF', '#4D7CFF', '#7C3AED', '#0891B2', '#DB2777'];

const DATA_CLASS_STYLE: Record<ChartSpec['dataClass'], string> = {
  measured: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  derived: 'bg-accent/5 text-accent border-accent/20',
  synthetic: 'bg-amber-50 text-amber-700 border-amber-200',
};

const DATA_CLASS_LABEL: Record<ChartSpec['dataClass'], string> = {
  measured: 'Measured',
  derived: 'Derived',
  synthetic: 'Synthetic scenario',
};

function formatPeriod(period: ChartSpec['period']): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };
  if (period.cadence === 'snapshot') return `Snapshot ${fmt(period.start)}`;
  return `${fmt(period.start)} – ${fmt(period.end)} (${period.cadence})`;
}

/**
 * Empty state shown when the planner refused to build the chart.
 *
 * The reasons are surfaced verbatim. "Observations use incompatible units" tells
 * a user something real; a blank panel tells them the product is broken.
 */
function UnavailableChart({ title, reasons }: { title: string; reasons: string[] }) {
  return (
    <div className="veracity-card p-6 flex flex-col gap-3">
      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
        {title}
      </div>
      <div className="text-sm text-foreground">Not enough evidence to chart this.</div>
      <ul className="flex flex-col gap-1 list-none p-0 m-0">
        {reasons.map((reason, i) => (
          <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
            <span className="text-muted-foreground mt-0.5">–</span>
            <span>{reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartSpecView({ spec, unavailableReasons, onOpenEvidence }: ChartSpecViewProps) {
  const { isDark } = useTheme();
  const [showMethod, setShowMethod] = useState(false);

  const tickFill = isDark ? '#C5D6E8' : '#334155';
  const gridStroke = isDark ? 'rgba(197,214,232,0.15)' : 'rgba(51,65,85,0.12)';

  const dimensionKey = spec.dimensions[0] ?? 'period';

  const chartRows = useMemo(
    () =>
      spec.rows.map((row) => {
        const out: Record<string, string | number | null> = { [dimensionKey]: row[dimensionKey] ?? '' };
        for (const s of spec.series) {
          const value = row[s.key];
          // Preserve null so the line breaks. Coercing to 0 would draw a
          // collapse that never happened.
          out[s.key] = typeof value === 'number' ? value : value == null ? null : Number(value);
        }
        return out;
      }),
    [spec.rows, spec.series, dimensionKey],
  );

  const download = () => {
    downloadCsv(
      `veracity-${spec.id}.csv`,
      rowsToCsv(
        [dimensionKey, ...spec.series.map((s) => s.key), 'unit', 'data_class', 'generated_at'],
        spec.rows.map((row) => [
          String(row[dimensionKey] ?? ''),
          ...spec.series.map((s) => (row[s.key] == null ? '' : String(row[s.key]))),
          spec.unit,
          spec.dataClass,
          spec.generatedAt,
        ]),
      ),
    );
  };

  if (unavailableReasons && unavailableReasons.length > 0) {
    return <UnavailableChart title={spec.title} reasons={unavailableReasons} />;
  }

  const Chart = spec.kind === 'line' ? LineChart : BarChart;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {spec.title}
          </div>
          {/* The question makes a chart accountable: if it answers nothing, it
              should not be on screen. */}
          <p className="text-xs text-muted-foreground">{spec.questionAnswered}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${DATA_CLASS_STYLE[spec.dataClass]}`}
          >
            {DATA_CLASS_LABEL[spec.dataClass]}
          </span>
          {spec.isEstimated ? (
            <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              Contains estimates
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setShowMethod((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] font-mono text-accent hover:opacity-80"
            aria-expanded={showMethod}
          >
            <Info size={11} /> Method
          </button>
          <button
            type="button"
            onClick={download}
            className="inline-flex items-center gap-1 text-[10px] font-mono text-accent hover:opacity-80"
          >
            <Download size={11} /> CSV
          </button>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={chartRows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis
              dataKey={dimensionKey}
              tick={{ fill: tickFill, fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: gridStroke }}
            />
            <YAxis
              tick={{ fill: tickFill, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              label={{
                value: spec.unit,
                angle: -90,
                position: 'insideLeft',
                fill: tickFill,
                fontSize: 10,
              }}
            />
            <Tooltip
              contentStyle={{
                background: isDark ? '#0F172A' : '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: 12,
                fontSize: 12,
              }}
              // A null cell reaches the tooltip as undefined; say so rather
              // than rendering "undefined USD/month".
              formatter={(value) =>
                value == null ? ['No observation', ''] : [`${value} ${spec.unit}`, '']
              }
            />
            {spec.series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
            {spec.series.map((s, i) =>
              spec.kind === 'line' ? (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  // Gaps stay gaps rather than being bridged across a period
                  // we never observed.
                  connectNulls={false}
                />
              ) : (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ),
            )}
          </Chart>
        </ResponsiveContainer>
      </div>

      {showMethod ? (
        <div className="veracity-card p-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Metric">{spec.metricDefinition}</Field>
            <Field label="Unit">{spec.unit}</Field>
            <Field label="Period">{formatPeriod(spec.period)}</Field>
            <Field label="Sample size">
              {spec.sampleSize == null ? 'Not recorded' : `${spec.sampleSize} observation(s)`}
            </Field>
          </div>

          {spec.formula ? <Field label="Formula">{spec.formula}</Field> : null}

          {spec.limitations.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Limitations
              </span>
              <ul className="flex flex-col gap-1 list-none p-0 m-0">
                {spec.limitations.map((l, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="mt-0.5">–</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[10px] font-mono text-muted-foreground">
              Generated {new Date(spec.generatedAt).toLocaleString()}
            </span>
            {onOpenEvidence && spec.evidenceSpanIds.length > 0 ? (
              <button
                type="button"
                onClick={() => onOpenEvidence(spec.evidenceSpanIds)}
                className="text-[10px] font-mono text-accent hover:underline"
              >
                Show the {spec.evidenceSpanIds.length} excerpt(s) behind this
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xs text-foreground">{children}</span>
    </div>
  );
}
