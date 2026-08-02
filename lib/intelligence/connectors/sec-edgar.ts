/**
 * SEC EDGAR connector.
 *
 * Standardised XBRL company facts: audited, dated, filed numbers with stated
 * units. For a US public competitor this is the strongest evidence the product
 * can obtain anywhere, and it needs no API key.
 *
 * The limits are as important as the capability, and both are surfaced to the
 * caller rather than glossed:
 *   - US SEC registrants only. Most competitors will not be covered.
 *   - Filed figures are periodic, so the newest fact can be months old.
 *   - A restated period appears more than once; the latest filing wins.
 *
 * The SEC requires a declared User-Agent identifying the requester. Set
 * `SEC_EDGAR_USER_AGENT` to a real contact string in any deployment that hits
 * this endpoint with volume.
 */

import { safeFetch } from '@/lib/net/outbound-policy';
import type { ExtractedSpan } from '../evidence-extractor';

const COMPANY_FACTS = 'https://data.sec.gov/api/xbrl/companyfacts';
const COMPANY_TICKERS = 'https://www.sec.gov/files/company_tickers.json';

export interface SecFact {
  /** XBRL concept, e.g. 'Revenues'. */
  concept: string;
  value: number;
  unit: string;
  /** Period the figure describes. */
  start: string | null;
  end: string;
  /** Fiscal year and period as filed. */
  fiscalYear: number | null;
  fiscalPeriod: string | null;
  /** Form the figure was filed on, e.g. '10-K'. */
  form: string;
  filedAt: string;
  accession: string;
}

export type SecResult<T> =
  | { ok: true; data: T; sourceUrl: string; retrievedAt: string }
  | { ok: false; reason: string; sourceUrl: string };

function headers(): Record<string, string> {
  return {
    // SEC access policy requires a declaring User-Agent.
    'User-Agent':
      process.env.SEC_EDGAR_USER_AGENT ?? 'Veracity Market Intelligence (contact@example.com)',
    Accept: 'application/json',
  };
}

/** Pad a CIK to the ten digits the facts endpoint expects. */
export function normalizeCik(cik: string | number): string {
  return String(cik).replace(/\D/g, '').padStart(10, '0');
}

/**
 * Resolve a company name or ticker to a CIK.
 *
 * Exact ticker matches win over name matches: "Block" is a company name and
 * also a common word, whereas a ticker is unambiguous.
 */
export async function resolveCik(query: string): Promise<SecResult<{ cik: string; name: string; ticker: string }>> {
  try {
    const response = await safeFetch(COMPANY_TICKERS, { headers: headers(), timeoutMs: 15_000 });
    if (!response.ok) {
      return { ok: false, reason: `SEC returned ${response.status}`, sourceUrl: COMPANY_TICKERS };
    }

    const body = (await response.json()) as Record<string, { cik_str: number; ticker: string; title: string }>;
    const entries = Object.values(body);
    const needle = query.trim().toLowerCase();

    const byTicker = entries.find((e) => e.ticker?.toLowerCase() === needle);
    const match =
      byTicker ??
      entries.find((e) => e.title?.toLowerCase() === needle) ??
      entries.find((e) => e.title?.toLowerCase().startsWith(needle));

    if (!match) {
      // A miss is the common case — most competitors are private — so it is
      // reported plainly rather than as an error condition.
      return { ok: false, reason: `no SEC registrant matches "${query}"`, sourceUrl: COMPANY_TICKERS };
    }

    return {
      ok: true,
      data: { cik: normalizeCik(match.cik_str), name: match.title, ticker: match.ticker },
      sourceUrl: COMPANY_TICKERS,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
      sourceUrl: COMPANY_TICKERS,
    };
  }
}

/**
 * Fetch one XBRL concept's history for a company.
 *
 * Restatements are deduplicated by period, keeping the most recently filed
 * value — otherwise one period appears two or three times and a chart shows
 * phantom volatility that is really just amended filings.
 */
export async function fetchCompanyFact(params: {
  cik: string;
  concept: string;
  taxonomy?: string;
}): Promise<SecResult<SecFact[]>> {
  const cik = normalizeCik(params.cik);
  const taxonomy = params.taxonomy ?? 'us-gaap';
  const sourceUrl = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}`;
  const apiUrl = `${COMPANY_FACTS}/CIK${cik}.json`;

  try {
    const response = await safeFetch(apiUrl, { headers: headers(), timeoutMs: 20_000 });
    if (response.status === 404) {
      return { ok: false, reason: 'no company facts filed for this CIK', sourceUrl };
    }
    if (!response.ok) {
      return { ok: false, reason: `SEC returned ${response.status}`, sourceUrl };
    }

    const body = (await response.json()) as {
      facts?: Record<string, Record<string, { units?: Record<string, unknown[]> }>>;
    };

    const conceptData = body.facts?.[taxonomy]?.[params.concept];
    if (!conceptData?.units) {
      return { ok: false, reason: `concept ${taxonomy}:${params.concept} not filed`, sourceUrl };
    }

    const facts: SecFact[] = [];
    for (const [unit, entries] of Object.entries(conceptData.units)) {
      for (const raw of entries as Array<Record<string, unknown>>) {
        if (typeof raw.val !== 'number' || typeof raw.end !== 'string') continue;
        facts.push({
          concept: params.concept,
          value: raw.val,
          unit,
          start: typeof raw.start === 'string' ? raw.start : null,
          end: raw.end,
          fiscalYear: typeof raw.fy === 'number' ? raw.fy : null,
          fiscalPeriod: typeof raw.fp === 'string' ? raw.fp : null,
          form: String(raw.form ?? ''),
          filedAt: String(raw.filed ?? ''),
          accession: String(raw.accn ?? ''),
        });
      }
    }

    return {
      ok: true,
      data: dedupeRestatements(facts),
      sourceUrl,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err), sourceUrl };
  }
}

/**
 * Keep the most recently filed value for each (start, end, unit) period.
 *
 * Exported because the behaviour is worth testing directly: silently double
 * counting a restated quarter is the kind of error that looks like a real
 * business swing.
 */
export function dedupeRestatements(facts: SecFact[]): SecFact[] {
  const latest = new Map<string, SecFact>();

  for (const fact of facts) {
    const key = `${fact.start ?? ''}|${fact.end}|${fact.unit}`;
    const existing = latest.get(key);
    if (!existing || fact.filedAt > existing.filedAt) latest.set(key, fact);
  }

  return [...latest.values()].sort((a, b) => a.end.localeCompare(b.end));
}

/** Keep only annual figures — 10-K filings covering roughly a full year. */
export function annualOnly(facts: SecFact[]): SecFact[] {
  return facts.filter((f) => {
    if (!f.form.startsWith('10-K')) return false;
    if (!f.start) return true; // point-in-time balance figure
    const days = (new Date(f.end).getTime() - new Date(f.start).getTime()) / 86_400_000;
    return days > 300 && days < 400;
  });
}

/**
 * Convert filed facts into evidence spans with observations.
 *
 * The excerpt names the concept, value, unit, period, form, and accession
 * number, so the drawer shows something a reader can look up in EDGAR directly.
 */
export function factsToSpans(facts: SecFact[], companyName: string): ExtractedSpan[] {
  return facts.map((fact) => {
    const period = fact.start ? `${fact.start} to ${fact.end}` : `as of ${fact.end}`;
    const excerpt =
      `${companyName} filed ${fact.concept} of ${fact.value.toLocaleString()} ${fact.unit} ` +
      `for ${period} on form ${fact.form} (accession ${fact.accession}, filed ${fact.filedAt}).`;

    return {
      excerpt,
      startOffset: 0,
      endOffset: excerpt.length,
      extractionType: 'metric',
      // The facts endpoint was queried by CIK, so the company is certain.
      entityMatch: 'confirmed',
      statement: `${companyName} reported ${fact.concept} of ${fact.value.toLocaleString()} ${fact.unit} for ${period}`,
      metric: {
        key: fact.concept,
        value: fact.value,
        unit: fact.unit,
        periodStart: fact.start ? `${fact.start}T00:00:00.000Z` : null,
        periodEnd: `${fact.end}T00:00:00.000Z`,
        // A filed figure is reported, not estimated.
        isEstimated: false,
      },
    };
  });
}
