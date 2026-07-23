/** ISO week key YYYY-Www (UTC). */
export function isoWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120);
}

/** Stable dedupe key: competitor + product + title + ISO week. */
export function buildAlertDedupeKey(input: {
  competitor: string;
  product: string;
  title: string;
  week?: string;
}): string {
  const week = input.week ?? isoWeekKey();
  const raw = [
    input.competitor.trim().toLowerCase(),
    input.product.trim().toLowerCase(),
    normalizeTitle(input.title),
    week,
  ].join('|');
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h * 31 + raw.charCodeAt(i)) | 0;
  }
  return `alert_${(h >>> 0).toString(16)}_${week}`;
}
