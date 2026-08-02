/**
 * The per-project collection run.
 *
 * This is the loop that makes the product worth returning to: fetch the
 * approved sources, compare each against what we stored last time, and do
 * expensive work *only* where something actually moved.
 *
 * The no-change short circuit is the economic heart of the whole product. A
 * general chatbot re-researches the market from scratch every time it is asked.
 * Here, a week in which three tracked pages are untouched costs three HTTP
 * requests and no model calls at all. That is what lets a refresh be cheap
 * enough to run on a schedule, and it is why the research targets >90% of
 * no-change runs skipping synthesis.
 *
 * Dependencies are injected rather than imported so the pipeline can be tested
 * deterministically without network or database. The orchestration logic is the
 * part worth testing; fetching and persisting are not.
 */

import { prepareSnapshot, type PreparedSnapshot } from './snapshot-store';
import { detectMetricChange, buildDedupeKey, scoreMateriality, materialityToConfidence } from './change-detector';
import type { ExtractedSpan } from './evidence-extractor';
import type { ChangeEvent } from './types';

// ── Ports ───────────────────────────────────────────────────────────────────

export interface SourceDefinition {
  url: string;
  sourceType?: string;
  entityId: string;
  entityLabel: string;
  /** Whether this entity is one the project explicitly tracks. */
  isTracked?: boolean;
  sourceTrust?: 'official' | 'press' | 'community' | 'unknown';
}

export interface FetchedPage {
  content: string;
  title?: string;
}

export interface CollectionPorts {
  /** Retrieve a page. Should already be behind the outbound URL policy. */
  fetchPage: (url: string) => Promise<FetchedPage | null>;
  /** Content hash of the newest stored snapshot for this source, if any. */
  previousHash: (url: string, entityId: string) => Promise<string | null>;
  /** Latest stored value per metric key for this entity, for diffing. */
  previousMetrics: (entityId: string) => Promise<Map<string, { value: number; unit: string }>>;
  /** Persist a snapshot and return its id. */
  saveSnapshot: (params: { source: SourceDefinition; snapshot: PreparedSnapshot }) => Promise<string>;
  /** Extract evidence. Only called when the content actually changed. */
  extract: (params: {
    normalizedContent: string;
    entityName: string;
    sourceUrl: string;
  }) => Promise<{ spans: ExtractedSpan[]; status: 'ok' | 'partial' | 'failed' }>;
  /** Persist spans and their observations. */
  saveEvidence: (params: {
    snapshotId: string;
    entityId: string;
    spans: ExtractedSpan[];
  }) => Promise<void>;
  /** Persist a change event. Returns false when it was already recorded. */
  saveChangeEvent: (event: Omit<ChangeEvent, 'id'> & { entityId: string }) => Promise<boolean>;
}

export interface CollectionOptions {
  /** The project's stated decision focus, used in materiality scoring. */
  decisionFocus?: string | null;
  /** Below this, a change is recorded but not surfaced as material. */
  materialityThreshold?: number;
}

// ── Result ──────────────────────────────────────────────────────────────────

export interface SourceOutcome {
  url: string;
  status: 'unchanged' | 'changed' | 'new' | 'unreachable' | 'extraction-failed';
  /** True when the expensive path (extraction + synthesis) was skipped. */
  skippedExpensiveWork: boolean;
  spanCount: number;
  changeCount: number;
  detail?: string;
}

export interface CollectionResult {
  outcomes: SourceOutcome[];
  materialChanges: Array<{ url: string; event: Omit<ChangeEvent, 'id'> & { entityId: string } }>;
  stats: {
    sourcesChecked: number;
    unchanged: number;
    changed: number;
    unreachable: number;
    /** Share of sources that avoided extraction. The headline cost metric. */
    shortCircuitRate: number;
  };
}

/**
 * Run one collection pass over a project's sources.
 *
 * Sources are processed independently: one unreachable page must not abort the
 * run, because a returning user's dashboard is more useful with four of five
 * sources refreshed than with an error.
 */
export async function runCollection(
  sources: SourceDefinition[],
  ports: CollectionPorts,
  options: CollectionOptions = {},
): Promise<CollectionResult> {
  const outcomes: SourceOutcome[] = [];
  const materialChanges: CollectionResult['materialChanges'] = [];
  const threshold = options.materialityThreshold ?? 0.5;

  for (const source of sources) {
    try {
      const page = await ports.fetchPage(source.url);
      if (!page) {
        outcomes.push({
          url: source.url,
          status: 'unreachable',
          skippedExpensiveWork: true,
          spanCount: 0,
          changeCount: 0,
          detail: 'the source could not be retrieved',
        });
        continue;
      }

      const prepared = prepareSnapshot({
        url: source.url,
        title: page.title,
        content: page.content,
        sourceType: source.sourceType,
      });

      if (!prepared.ok) {
        outcomes.push({
          url: source.url,
          status: 'unreachable',
          skippedExpensiveWork: true,
          spanCount: 0,
          changeCount: 0,
          detail: prepared.reason,
        });
        continue;
      }

      const previous = await ports.previousHash(source.url, source.entityId);

      // ── The short circuit ──────────────────────────────────────────────
      // Identical content means nothing to extract and nothing to say. We do
      // not store a duplicate snapshot, do not call the model, and do not emit
      // an event. Freshness is updated by the fact that we looked.
      if (previous && previous === prepared.snapshot.contentHash) {
        outcomes.push({
          url: source.url,
          status: 'unchanged',
          skippedExpensiveWork: true,
          spanCount: 0,
          changeCount: 0,
        });
        continue;
      }

      const snapshotId = await ports.saveSnapshot({ source, snapshot: prepared.snapshot });

      const extraction = await ports.extract({
        normalizedContent: prepared.snapshot.normalizedContent,
        entityName: source.entityLabel,
        sourceUrl: source.url,
      });

      if (extraction.status === 'failed') {
        // The snapshot is kept — it is still a record of what the page said —
        // but no evidence is claimed from it.
        outcomes.push({
          url: source.url,
          status: 'extraction-failed',
          skippedExpensiveWork: false,
          spanCount: 0,
          changeCount: 0,
          detail: 'the page was stored but no evidence could be extracted',
        });
        continue;
      }

      // Read the baseline *before* writing the new observations. Saving first
      // and reading after makes the value we just stored its own predecessor,
      // so every change silently compares equal and nothing is ever detected.
      // Copied, not aliased. A port backed by a cache could hand back a live
      // view that `saveEvidence` then mutates, which would move the baseline
      // to the new value and make every comparison read as unchanged.
      const isFirstSighting = previous === null;
      const priorMetrics = isFirstSighting
        ? new Map<string, { value: number; unit: string }>()
        : new Map(await ports.previousMetrics(source.entityId));

      await ports.saveEvidence({ snapshotId, entityId: source.entityId, spans: extraction.spans });

      // A first sighting is not a change. Recording one would fire a burst of
      // events the day a project is created.
      let changeCount = 0;

      if (!isFirstSighting) {
        for (const span of extraction.spans) {
          if (!span.metric) continue;

          const change = detectMetricChange({
            metricKey: span.metric.key,
            before: priorMetrics.get(span.metric.key) ?? null,
            after: { value: span.metric.value, unit: span.metric.unit },
            excerpt: span.excerpt,
          });
          if (!change) continue;

          const materiality = scoreMateriality({
            eventType: change.eventType,
            magnitude: change.magnitude,
            sourceTrust: source.sourceTrust ?? 'unknown',
            isTrackedEntity: source.isTracked ?? true,
            decisionFocus: options.decisionFocus ?? null,
          });

          const event = {
            entityId: source.entityId,
            eventType: change.eventType,
            beforeValue: change.beforeValue,
            afterValue: change.afterValue,
            effectiveAt: null,
            observedAt: new Date().toISOString(),
            fromSnapshotId: null,
            toSnapshotId: snapshotId,
            evidenceSpanId: null,
            materiality: materiality.score,
            materialityReason: materiality.reason,
            confidence: materialityToConfidence(materiality.score),
            dedupeKey: buildDedupeKey({
              entityId: source.entityId,
              eventType: change.eventType,
              beforeValue: change.beforeValue,
              afterValue: change.afterValue,
            }),
          } satisfies Omit<ChangeEvent, 'id'> & { entityId: string };

          const isNew = await ports.saveChangeEvent(event);
          if (!isNew) continue; // already reported in an earlier run

          changeCount += 1;
          if (materiality.score >= threshold) {
            materialChanges.push({ url: source.url, event });
          }
        }
      }

      outcomes.push({
        url: source.url,
        status: isFirstSighting ? 'new' : 'changed',
        skippedExpensiveWork: false,
        spanCount: extraction.spans.length,
        changeCount,
      });
    } catch (err) {
      // One bad source must not take down the run.
      outcomes.push({
        url: source.url,
        status: 'unreachable',
        skippedExpensiveWork: true,
        spanCount: 0,
        changeCount: 0,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const unchanged = outcomes.filter((o) => o.status === 'unchanged').length;
  const changed = outcomes.filter((o) => o.status === 'changed' || o.status === 'new').length;
  const unreachable = outcomes.filter((o) => o.status === 'unreachable').length;

  return {
    outcomes,
    materialChanges,
    stats: {
      sourcesChecked: sources.length,
      unchanged,
      changed,
      unreachable,
      shortCircuitRate:
        sources.length === 0
          ? 0
          : Number(
              (outcomes.filter((o) => o.skippedExpensiveWork).length / sources.length).toFixed(3),
            ),
    },
  };
}
