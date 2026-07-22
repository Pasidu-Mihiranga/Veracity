'use client';

import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import type { AgentOutput, CompetitiveOutput } from '@/lib/agents/types';
import type { ChatMessage } from '@/types/chat-ui';
import { useTheme } from '@/lib/theme-provider';

type Rec = {
  priority?: string;
  confidence?: string;
};

type Props = {
  message: ChatMessage;
  outputs: AgentOutput[];
};

function readCssColor(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: { name?: string } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0];
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs shadow-sm"
      style={{
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        color: 'var(--foreground)',
      }}
    >
      <p className="font-semibold mb-0.5">{label ?? row.payload?.name ?? row.name}</p>
      <p style={{ color: 'var(--foreground-muted)' }}>{row.value}</p>
    </div>
  );
}

/**
 * Familiar executive charts derived from results — pie + bars.
 * Only renders when there is enough structured data.
 */
export function ResultsInsightCharts({ message, outputs }: Props) {
  const { isDark, textSubtle, textMuted, foreground } = useTheme();
  const tick = isDark ? '#C5D6E8' : '#334155';

  const colors = useMemo(() => {
    // Resolve once for Recharts (needs concrete fills)
    return [
      readCssColor('--chart-1', '#00C4FF'),
      readCssColor('--chart-2', '#38BDF8'),
      readCssColor('--chart-3', '#60A5FA'),
      readCssColor('--chart-4', '#22D3EE'),
      readCssColor('--chart-5', '#8AA0B5'),
    ];
  }, [isDark]);

  const competitive = outputs.find((o): o is CompetitiveOutput => o.artifactType === 'competitive-matrix');

  const gapPie = useMemo(() => {
    const matrix = competitive?.matrix ?? [];
    if (matrix.length === 0) return [];
    const counts = { advantage: 0, parity: 0, disadvantage: 0 };
    for (const row of matrix) {
      if (row.gapDirection in counts) counts[row.gapDirection as keyof typeof counts] += 1;
    }
    return [
      { name: 'Advantage', value: counts.advantage, key: 'advantage' },
      { name: 'Parity', value: counts.parity, key: 'parity' },
      { name: 'Gap', value: counts.disadvantage, key: 'disadvantage' },
    ].filter((d) => d.value > 0);
  }, [competitive]);

  const confidenceBars = useMemo(() => {
    const score = (c: string) => (c === 'high' ? 3 : c === 'medium' ? 2 : 1);
    return outputs
      .filter((o) => o.artifactType !== 'mind-map')
      .slice(0, 8)
      .map((o) => ({
        name: o.domain.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 14),
        score: score(o.confidence),
        label: o.confidence,
      }));
  }, [outputs]);

  const priorityBars = useMemo(() => {
    const recs = (message.recommendations ?? []) as Rec[];
    if (recs.length === 0) return [];
    const counts: Record<string, number> = {};
    for (const r of recs) {
      const key = (r.priority || 'strategic').toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({
      name: name.replace(/-/g, ' '),
      value,
    }));
  }, [message.recommendations]);

  const hasAny = gapPie.length > 0 || confidenceBars.length > 1 || priorityBars.length > 0;
  if (!hasAny) return null;

  const gridStroke = isDark ? 'rgba(168,192,216,0.12)' : 'rgba(6,20,36,0.08)';

  return (
    <section className="results-panel p-5 lg:p-6">
      <p className="results-section-title mb-1">Insight charts</p>
      <p className="ui-caption mb-5" style={{ color: textMuted }}>
        Snapshot of competitive gaps, agent confidence, and recommendation urgency
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {gapPie.length > 0 ? (
          <div
            className="rounded-2xl p-4 flex flex-col"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
          >
            <p className="ui-title mb-1">Competitive gap mix</p>
            <p className="ui-caption mb-3" style={{ color: textSubtle }}>
              Share of features by gap vs competitors
            </p>
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gapPie}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="48%"
                    innerRadius={48}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  >
                    {gapPie.map((_, i) => (
                      <Cell key={i} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    formatter={(value) => (
                      <span style={{ color: foreground, fontSize: 11 }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {confidenceBars.length > 1 ? (
          <div
            className="rounded-2xl p-4 flex flex-col"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
          >
            <p className="ui-title mb-1">Domain confidence</p>
            <p className="ui-caption mb-3" style={{ color: textSubtle }}>
              High = 3 · Medium = 2 · Low = 1
            </p>
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={confidenceBars} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: tick, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis
                    domain={[0, 3]}
                    ticks={[1, 2, 3]}
                    tick={{ fill: tick, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={28} fill={colors[0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

        {priorityBars.length > 0 ? (
          <div
            className="rounded-2xl p-4 flex flex-col"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}
          >
            <p className="ui-title mb-1">Recommendation urgency</p>
            <p className="ui-caption mb-3" style={{ color: textSubtle }}>
              Count by priority band
            </p>
            <div className="w-full h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityBars} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={88}
                    tick={{ fill: tick, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={22} fill={colors[1]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
