'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { MarketTrendsOutput, TrendDataPoint } from '@/lib/agents/types';
import { useTheme } from '@/lib/theme-provider';
import { buildTrendChartData } from '@/lib/trend-chart-data';
import { Download } from 'lucide-react';
import { downloadCsv, rowsToCsv } from '@/lib/csv-download';

interface TrendChartProps {
  output: MarketTrendsOutput;
}

const OUTLOOK_STYLE = {
  accelerating: { color: '#38BDF8', bg: 'rgba(14,165,233,0.16)', border: 'rgba(56,189,248,0.45)' },
  consolidating: { color: '#60A5FA', bg: 'rgba(59,130,246,0.16)', border: 'rgba(96,165,250,0.45)' },
  maturing: { color: '#93C5FD', bg: 'rgba(37,99,235,0.16)', border: 'rgba(147,197,253,0.4)' },
  emerging: { color: '#22D3EE', bg: 'rgba(6,182,212,0.16)', border: 'rgba(34,211,238,0.45)' },
};

const DIRECTION_COLOR = {
  up: '#00C4FF',
  flat: '#8AA0B5',
  down: '#64748B',
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TrendDataPoint }> }) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div
        className="rounded-xl p-3 text-xs max-w-[220px]"
        style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
      >
        <p className="font-mono font-medium mb-1">{d.keyword}</p>
        <p className="leading-relaxed" style={{ color: 'var(--foreground-muted)' }}>{d.signal}</p>
        <p className="text-[10px] mt-1 font-mono" style={{ color: 'var(--foreground-subtle)' }}>Source: {d.source}</p>
      </div>
    );
  }
  return null;
}

export function TrendChart({ output }: TrendChartProps) {
  const { isDark, textMuted, textSubtle } = useTheme();
  const trends = output.trends ?? [];
  const keySignals = output.keySignals ?? [];
  const categoryOutlook = output.categoryOutlook;
  const timeHorizon = output.timeHorizon;
  const outlook = OUTLOOK_STYLE[categoryOutlook] ?? OUTLOOK_STYLE.emerging;
  const tickFill = isDark ? '#C5D6E8' : '#334155';

  const chartData = buildTrendChartData(trends);
  const downloadData = () => {
    downloadCsv('veracity-market-trends.csv', rowsToCsv(
      ['keyword', 'direction', 'change_percent', 'signal', 'source', 'time_horizon', 'generated_at', 'data_class'],
      chartData.map((trend) => [
        trend.keyword, trend.direction, trend.changePercent, trend.signal, trend.source,
        timeHorizon, output.generatedAt, output.dataClass ?? 'derived',
      ]),
    ));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs font-mono uppercase tracking-wider" style={{ color: textMuted }}>
          Market Trend Analysis
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider"
            style={{ color: outlook.color, background: outlook.bg, borderColor: outlook.border }}
          >
            {categoryOutlook}
          </span>
          <span className="text-[10px] font-mono" style={{ color: textSubtle }}>
            {timeHorizon}
          </span>
          {chartData.length > 0 ? (
            <button type="button" onClick={downloadData} className="inline-flex items-center gap-1 text-[10px] font-mono text-accent hover:opacity-80">
              <Download size={11} /> CSV
            </button>
          ) : null}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="w-full" style={{ height: Math.max(160, chartData.length * 44) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <XAxis type="number" hide domain={['dataMin - 5', 'dataMax + 5']} />
              <YAxis
                type="category"
                dataKey="keyword"
                width={120}
                tick={{ fontSize: 11, fill: tickFill }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,196,255,0.06)' }} />
              <Bar dataKey="absValue" radius={[0, 6, 6, 0]} maxBarSize={22}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={DIRECTION_COLOR[d.direction]} fillOpacity={0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {trends.length > 0 && chartData.length === 0 && (
        <div
          className="rounded-xl px-4 py-3 text-[12px]"
          style={{ background: 'var(--surface-raised)', color: textMuted, border: '1px solid var(--border)' }}
        >
          Directional signals are available, but the sources did not provide comparable numeric changes. No percentage chart is shown.
        </div>
      )}

      <div className="flex items-center gap-4 text-[10px] font-mono" style={{ color: textMuted }}>
        {(['up', 'flat', 'down'] as const).map((dir) => (
          <span key={dir} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: DIRECTION_COLOR[dir] }} />
            {dir === 'up' ? 'Growing' : dir === 'flat' ? 'Stable' : 'Declining'}
          </span>
        ))}
      </div>

      {keySignals.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-mono uppercase tracking-wider" style={{ color: textMuted }}>
            Key Signals
          </p>
          {keySignals.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--foreground)' }}>
              <span className="shrink-0 mt-0.5" style={{ color: 'var(--accent)' }}>
                ›
              </span>
              <span className="leading-snug">{s}</span>
            </div>
          ))}
        </div>
      )}

      <details className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
        <summary className="cursor-pointer text-[10px] font-mono uppercase tracking-wider" style={{ color: textMuted }}>
          Methodology and sources
        </summary>
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: textMuted }}>
          Percent changes are derived by the research model from the cited market signals; they are not a calibrated market index. Period: {timeHorizon || 'not specified'}. Numeric rows: {chartData.length}. Generated: {new Date(output.generatedAt).toLocaleString()}.
        </p>
        {output.sources.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {output.sources.map((source, index) => (
              <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="text-[10px] font-mono text-accent hover:underline">
                {source.title}
              </a>
            ))}
          </div>
        ) : <p className="mt-2 text-[11px] text-amber-600">No source links were stored for this artifact.</p>}
      </details>
    </div>
  );
}
