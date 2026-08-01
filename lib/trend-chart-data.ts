import type { TrendDataPoint } from '@/lib/agents/types';

export function buildTrendChartData(trends: TrendDataPoint[]) {
  return trends
    .filter((trend) => Number.isFinite(trend.changePercent))
    .map((trend) => {
      const magnitude = Math.abs(trend.changePercent);
      return {
        ...trend,
        displayValue: trend.direction === 'down' ? -magnitude : magnitude,
        absValue: magnitude,
      };
    });
}

