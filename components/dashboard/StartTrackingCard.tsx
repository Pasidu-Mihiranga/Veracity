'use client';

/**
 * Turning a first-time visitor into someone with a tracked competitor.
 *
 * This is the fix for the most expensive gap in the product: twenty-seven built
 * components — the dashboard, evidence ledger, charts, timeline, since-last-visit
 * — all render behind `selectedProject`, and the only way to get one was a 13px
 * unlabelled folder icon in the sidebar. New users never found it, so they only
 * ever saw the one-shot chat and judged the product on that.
 *
 * Three deliberate choices:
 *
 *  1. **Inline, not a modal.** A modal is a decision to interrupt someone. This
 *     is the main thing we want them to do, so it is the main thing on screen.
 *  2. **Three fields.** `name` is derived from the product rather than asked for
 *     — a separate "project name" is our data model leaking into their first
 *     thirty seconds. The API's ON CONFLICT (user_id, name) then makes re-adding
 *     the same product an update instead of a duplicate.
 *  3. **Says what happens next.** Agentic UX research is consistent that people
 *     accept an agent acting on their behalf when they are told what it will do
 *     first. "We'll read their pages and tell you what changed" is that promise.
 */

import { useState } from 'react';
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { createMarketProject, type MarketProject } from '@/lib/projects';

interface StartTrackingCardProps {
  onCreated: (project: MarketProject) => void;
  /** Rendered under the form so the question flow stays available. */
  children?: React.ReactNode;
}

/** Split on commas, drop blanks, and respect the API's limit of 20. */
function parseCompetitors(raw: string): string[] {
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/**
 * Accept what people actually type.
 *
 * Nobody types "https://". Requiring it would fail server validation on the most
 * common input in the form, so a bare domain is upgraded rather than rejected.
 */
function normaliseUrl(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function StartTrackingCard({ onCreated, children }: StartTrackingCardProps) {
  const [product, setProduct] = useState('');
  const [url, setUrl] = useState('');
  const [competitors, setCompetitors] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = product.trim().length > 0 && !busy;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    try {
      // The comparison is not "us versus them" — a user may be sizing up three
      // companies none of which is theirs. The schema stores one `product` plus
      // a `competitors` array, so the first name fills `product` and the rest
      // join the array. That is a storage detail; nothing in the UI implies the
      // first company is special.
      const names = [
        ...parseCompetitors(product),
        ...parseCompetitors(competitors),
      ];
      const [first, ...rest] = names;

      const created = await createMarketProject({
        name: names.join(' vs '),
        product: first,
        productUrl: normaliseUrl(url),
        competitors: rest.slice(0, 20),
      });
      onCreated(created);
    } catch (err) {
      // Say what failed and leave their typing intact. Clearing the form on
      // error means retyping everything to retry.
      setError(
        err instanceof Error
          ? `We could not save that: ${err.message}`
          : 'We could not save that. Please try again.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      <div className="veracity-card p-6 sm:p-7 flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="ui-section-label text-accent">Start here</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
            Compare companies
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Name the companies you want compared. We read their pages, keep
            watching them, and tell you what changed — with the exact sentence
            behind every number.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">
              Companies to compare
            </span>
            <input
              type="text"
              value={product}
              onChange={(event) => setProduct(event.target.value)}
              placeholder="e.g. PickMe, Uber, Kapruka"
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">
              Website of the first one{' '}
              <span className="font-normal text-muted-foreground">— optional</span>
            </span>
            <input
              type="text"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="pickme.lk"
              className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
            />
            <span className="text-xs text-muted-foreground">
              Giving us the address means we track the right company. Without it
              we may find a business with a similar name.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground">
              Anyone else{' '}
              <span className="font-normal text-muted-foreground">— optional</span>
            </span>
            <input
              type="text"
              value={competitors}
              onChange={(event) => setCompetitors(event.target.value)}
              placeholder="Add more names, separated by commas"
              className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
            />
            <span className="text-xs text-muted-foreground">
              Separate names with commas. You can add more later.
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400"
            >
              <AlertCircle size={14} className="shrink-0 mt-px" />
              <span>{error}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="bg-gradient-signature text-white rounded-xl py-3 px-4 font-medium transition-transform hover:-translate-y-[1px] hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Setting it up…
              </>
            ) : (
              <>
                Start tracking
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
      </div>

      {children}
    </div>
  );
}
