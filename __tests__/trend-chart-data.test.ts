import { describe, expect, it } from 'vitest';
import { buildTrendChartData } from '@/lib/trend-chart-data';
import type { TrendDataPoint } from '@/lib/agents/types';

function trend(changePercent: number, direction: TrendDataPoint['direction']): TrendDataPoint {
  return {
    keyword: 'agentic research',
    direction,
    changePercent,
    signal: 'Observed signal',
    source: 'Source',
  };
}

describe('trend chart data', () => {
  it('preserves an observed zero instead of inventing a five percent change', () => {
    expect(buildTrendChartData([trend(0, 'flat')])[0]?.absValue).toBe(0);
  });

  it('uses the observed magnitude and direction', () => {
    const result = buildTrendChartData([trend(12, 'down'), trend(7, 'up')]);
    expect(result.map((row) => [row.displayValue, row.absValue])).toEqual([
      [-12, 12],
      [7, 7],
    ]);
  });

  it('does not render non-numeric observations', () => {
    expect(buildTrendChartData([trend(Number.NaN, 'up')])).toEqual([]);
  });
});
