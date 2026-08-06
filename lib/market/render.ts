/**
 * Page renderers for the prototype dataset.
 *
 * Writing eight full page bodies by hand for every page of every company would
 * run to hundreds of near-identical blocks, and the near-identical part is
 * exactly where transcription mistakes hide. So each page declares what changes
 * month to month — a fare, a headcount, a news item — and these renderers turn
 * that into the prose the collector reads.
 *
 * The output has to read like a real page, because the extractor works on
 * sentences: it looks for numbers with units and labels near them. Prose with
 * figures in it produces metric observations; a bare table of numbers does not.
 */

import type { Month, PageDef, SourceKind } from './types';
import { MONTHS } from './types';

/** Build a page from a per-month renderer. */
function page(
  url: string,
  kind: SourceKind,
  render: (monthIndex: number) => string,
): PageDef {
  return { url, kind, monthly: MONTHS.map((_, i) => render(i)) };
}

/** Carry the last declared value forward. A page only changes in the months
 *  something actually happened; every other month is byte-identical, which is
 *  what makes "we looked and nothing moved" a real finding. */
export function carry<T>(points: Array<T | null>): T[] {
  const out: T[] = [];
  let last: T | undefined;
  for (const point of points) {
    if (point !== null && point !== undefined) last = point;
    if (last === undefined) throw new Error('carry() needs a value in the first slot');
    out.push(last);
  }
  return out;
}

export function monthName(month: Month): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

// ── Pricing ─────────────────────────────────────────────────────────────────

export interface PricingLine {
  /** What is being priced — "Tuk", "Bulk black tea", "Current account". */
  item: string;
  /** The headline number, already formatted with its unit. */
  price: string;
  /** The second number, where there is one. */
  secondary?: string;
}

export function pricingPage(
  url: string,
  title: string,
  monthly: Array<{ lines: PricingLine[]; note?: string }>,
): PageDef {
  return page(url, 'pricing', (i) => {
    const { lines, note } = monthly[i];
    const body = lines
      .map((line) =>
        line.secondary
          ? `${line.item}\n${line.price}. ${line.secondary}.`
          : `${line.item}\n${line.price}.`,
      )
      .join('\n\n');
    return `${title}\n\n${body}${note ? `\n\n${note}` : ''}`;
  });
}

// ── Changelog ───────────────────────────────────────────────────────────────

/**
 * Product updates, newest first, accumulating over time.
 *
 * Accumulating matters: a changelog that replaced its contents every month
 * would diff as "everything changed", and the detector would be right to say so.
 * Real changelogs grow at the top, and the diff is the new entry.
 */
export function changelogPage(
  url: string,
  title: string,
  entries: Array<{ month: Month; items: string[] } | null>,
): PageDef {
  return page(url, 'changelog', (i) => {
    const visible = entries
      .slice(0, i + 1)
      .filter((entry): entry is { month: Month; items: string[] } => entry !== null)
      .reverse();
    if (visible.length === 0) return `${title}\n\nNo updates published yet.`;
    const body = visible
      .map((entry) => `${monthName(entry.month)}\n${entry.items.map((item) => `${item}`).join('\n')}`)
      .join('\n\n');
    return `${title}\n\n${body}`;
  });
}

// ── Newsroom ────────────────────────────────────────────────────────────────

export function newsroomPage(
  url: string,
  title: string,
  releases: Array<{ month: Month; headline: string; body: string } | null>,
): PageDef {
  return page(url, 'newsroom', (i) => {
    const visible = releases
      .slice(0, i + 1)
      .filter((r): r is { month: Month; headline: string; body: string } => r !== null)
      .reverse();
    if (visible.length === 0) return `${title}\n\nNo announcements.`;
    const body = visible
      .map((r) => `${monthName(r.month)}\n${r.headline}\n${r.body}`)
      .join('\n\n');
    return `${title}\n\n${body}`;
  });
}

// ── Leadership ──────────────────────────────────────────────────────────────

export interface Officer {
  role: string;
  name: string;
  since: string;
}

/**
 * Who runs the company.
 *
 * A board page is mostly static and then changes in one line, which is the
 * cleanest possible signal: the diff is a person's name, and a business reader
 * needs no explanation of why that matters.
 */
export function leadershipPage(
  url: string,
  title: string,
  monthly: Array<{ officers: Officer[]; note?: string } | null>,
): PageDef {
  const filled = carry(monthly);
  return page(url, 'leadership', (i) => {
    const { officers, note } = filled[i];
    const body = officers
      .map((o) => `${o.role}: ${o.name}. Appointed ${o.since}.`)
      .join('\n');
    return `${title}\n\n${body}${note ? `\n\n${note}` : ''}`;
  });
}

// ── Careers ─────────────────────────────────────────────────────────────────

/**
 * Open roles by function.
 *
 * Hiring is the cheapest forward-looking signal there is: a company staffing up
 * a function is telling you what it intends to do six months before it does it.
 * The counts are written as prose so the extractor picks them up as metrics.
 */
export function careersPage(
  url: string,
  title: string,
  monthly: Array<{ counts: Array<{ team: string; open: number }>; note?: string } | null>,
): PageDef {
  const filled = carry(monthly);
  return page(url, 'careers', (i) => {
    const { counts, note } = filled[i];
    const total = counts.reduce((sum, c) => sum + c.open, 0);
    const body = counts
      .map((c) => `${c.team}: ${c.open} open ${c.open === 1 ? 'role' : 'roles'}.`)
      .join('\n');
    return `${title}\n\n${total} open positions across the group.\n\n${body}${
      note ? `\n\n${note}` : ''
    }`;
  });
}

// ── Regulator ───────────────────────────────────────────────────────────────

export function regulatorPage(
  url: string,
  title: string,
  notices: Array<{ month: Month; reference: string; headline: string; body: string } | null>,
): PageDef {
  return page(url, 'regulator', (i) => {
    const visible = notices
      .slice(0, i + 1)
      .filter(
        (n): n is { month: Month; reference: string; headline: string; body: string } =>
          n !== null,
      )
      .reverse();
    if (visible.length === 0) return `${title}\n\nNo notices issued in this period.`;
    const body = visible
      .map((n) => `${monthName(n.month)} — ${n.reference}\n${n.headline}\n${n.body}`)
      .join('\n\n');
    return `${title}\n\n${body}`;
  });
}
