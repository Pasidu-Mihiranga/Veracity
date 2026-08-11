/**
 * Mock data for the Home "Market at a glance" visualizations.
 *
 * UI scaffolding only — none of this is fetched. It gives the KPI strip, the
 * Market Momentum area chart and the Share of Voice donut realistic shapes to
 * render and animate against until they are wired to live monitoring data.
 */

/** Companies the demo user tracks. Order = rendering order everywhere. */
export const TRACKED_COMPANIES = [
  { key: 'dialog', label: 'Dialog Axiata', colorVar: '--chart-1', fallback: '#2A78D6' },
  { key: 'slt', label: 'SLT-Mobitel', colorVar: '--chart-3', fallback: '#1BAF7A' },
  { key: 'hutch', label: 'Hutch', colorVar: '--chart-4', fallback: '#EDA100' },
] as const;

export type CompanyKey = (typeof TRACKED_COMPANIES)[number]['key'];

/** Share of voice per week over the last 12 weeks (percent, sums ≈ 100). */
export interface MomentumPoint {
  week: string;
  dialog: number;
  slt: number;
  hutch: number;
}

export const MOMENTUM_SERIES: MomentumPoint[] = [
  { week: 'W1', dialog: 34, slt: 41, hutch: 25 },
  { week: 'W2', dialog: 35, slt: 40, hutch: 25 },
  { week: 'W3', dialog: 34, slt: 41, hutch: 25 },
  { week: 'W4', dialog: 36, slt: 39, hutch: 25 },
  { week: 'W5', dialog: 38, slt: 38, hutch: 24 },
  { week: 'W6', dialog: 37, slt: 39, hutch: 24 },
  { week: 'W7', dialog: 39, slt: 37, hutch: 24 },
  { week: 'W8', dialog: 40, slt: 37, hutch: 23 },
  { week: 'W9', dialog: 39, slt: 38, hutch: 23 },
  { week: 'W10', dialog: 41, slt: 36, hutch: 23 },
  { week: 'W11', dialog: 41, slt: 36, hutch: 23 },
  { week: 'W12', dialog: 41, slt: 37, hutch: 22 },
];

/** Current share of voice — the donut. Should roughly match the last momentum week. */
export const SHARE_OF_VOICE: Array<{ key: CompanyKey; label: string; value: number }> = [
  { key: 'dialog', label: 'Dialog Axiata', value: 41 },
  { key: 'slt', label: 'SLT-Mobitel', value: 37 },
  { key: 'hutch', label: 'Hutch', value: 22 },
];

/** The four KPI tiles across the top of the section. */
export interface HomeKpi {
  id: string;
  label: string;
  value: string;
  detail: string;
  delta?: { amount: number; period: string };
  series?: number[];
  tone?: 'accent' | 'warning';
}

export const HOME_KPIS: HomeKpi[] = [
  {
    id: 'momentum',
    label: 'Your momentum',
    value: '+7 pts',
    detail: 'Share of voice vs 12 weeks ago',
    delta: { amount: 7, period: 'vs last quarter' },
    series: [34, 35, 34, 36, 38, 37, 39, 40, 39, 41, 41, 41],
  },
  {
    id: 'changes',
    label: 'Changes this week',
    value: '3',
    detail: 'Material moves worth your attention',
    delta: { amount: 2, period: 'vs last week' },
    series: [1, 0, 2, 1, 3, 2, 3],
  },
  {
    id: 'share',
    label: 'Share of voice',
    value: '41%',
    detail: 'Dialog leads across search & social',
    delta: { amount: 2, period: 'this week' },
    series: [39, 40, 39, 41, 41, 41],
  },
  {
    id: 'health',
    label: 'Sources healthy',
    value: '18/19',
    detail: '1 source could not be read last run',
    tone: 'warning',
    series: [19, 19, 18, 19, 19, 18, 18],
  },
];
