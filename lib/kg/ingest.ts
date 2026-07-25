import { featureFlags } from '@/lib/feature-flags';
import type { OrchestratorOutput, Recommendation } from '@/lib/agents/types';
import { sourceTrustFromUrl } from '@/lib/kg/confidence';
import { hashClaimKey, normalizeEntityKey, sourceKeyFromUrl } from '@/lib/kg/normalize';
import {
  appendDomainEvent,
  recomputeClaimConfidence,
  upsertCanonicalNode,
  upsertEdge,
} from '@/lib/kg/store';
import type { Provenance } from '@/lib/kg/types';

export async function ingestOrchestratorOutput(input: {
  workspaceId: string;
  output: OrchestratorOutput;
  provenance?: Provenance;
  product?: string;
  competitor?: string;
}): Promise<{ claimCount: number; sourceCount: number }> {
  if (!featureFlags.evidenceGraph) return { claimCount: 0, sourceCount: 0 };

  let claimCount = 0;
  let sourceCount = 0;
  const productLabel = input.product || input.output.product || 'product';
  const competitorLabel = input.competitor || input.output.competitor;

  const productNode = await upsertCanonicalNode({
    workspaceId: input.workspaceId,
    kind: 'product',
    label: productLabel,
    key: normalizeEntityKey(productLabel),
    provenance: input.provenance,
    confidence: 0.7,
  });

  let competitorNodeId: string | null = null;
  if (competitorLabel) {
    const c = await upsertCanonicalNode({
      workspaceId: input.workspaceId,
      kind: 'competitor',
      label: competitorLabel,
      key: normalizeEntityKey(competitorLabel),
      provenance: input.provenance,
      confidence: 0.7,
    });
    competitorNodeId = c.id;
    await upsertEdge({
      workspaceId: input.workspaceId,
      fromNodeId: productNode.id,
      toNodeId: c.id,
      rel: 'competes_with',
      provenance: input.provenance,
    });
    await appendDomainEvent({
      workspaceId: input.workspaceId,
      aggregateType: 'competitor',
      aggregateKey: normalizeEntityKey(competitorLabel),
      eventType: 'observed_in_sweep',
      payload: { product: productLabel },
      provenance: input.provenance,
    });
  }

  const recs: Recommendation[] = input.output.topRecommendations ?? [];
  for (const rec of recs) {
    const claims = rec.evidence?.length ? rec.evidence : [rec.title];
    const urls = rec.sourceUrls ?? [];
    for (const claimText of claims.slice(0, 8)) {
      if (!claimText?.trim()) continue;
      const claim = await upsertCanonicalNode({
        workspaceId: input.workspaceId,
        kind: 'claim',
        label: claimText.slice(0, 280),
        key: hashClaimKey(claimText),
        props: { recommendationKey: rec.title },
        provenance: input.provenance,
        confidence: 0.45,
      });
      claimCount += 1;
      await upsertEdge({
        workspaceId: input.workspaceId,
        fromNodeId: claim.id,
        toNodeId: productNode.id,
        rel: 'about',
        provenance: input.provenance,
      });
      if (competitorNodeId) {
        await upsertEdge({
          workspaceId: input.workspaceId,
          fromNodeId: claim.id,
          toNodeId: competitorNodeId,
          rel: 'mentions',
          provenance: input.provenance,
        });
      }
      for (const url of urls.slice(0, 6)) {
        if (!url?.trim()) continue;
        const trust = sourceTrustFromUrl(url);
        const source = await upsertCanonicalNode({
          workspaceId: input.workspaceId,
          kind: 'source',
          label: url,
          key: sourceKeyFromUrl(url),
          props: { url },
          provenance: input.provenance,
          confidence: trust,
        });
        sourceCount += 1;
        await upsertEdge({
          workspaceId: input.workspaceId,
          fromNodeId: claim.id,
          toNodeId: source.id,
          rel: 'supports',
          trust,
          provenance: input.provenance,
        });
      }
      await recomputeClaimConfidence(input.workspaceId, claim.id);
    }
  }

  return { claimCount, sourceCount };
}

export async function ingestCompetitiveSignal(input: {
  workspaceId: string;
  product: string;
  competitor: string;
  title: string;
  summary: string;
  category?: string;
  jobId?: string;
  provenance?: Provenance;
}): Promise<void> {
  if (!featureFlags.evidenceGraph) return;

  const competitorKey = normalizeEntityKey(input.competitor);
  const competitor = await upsertCanonicalNode({
    workspaceId: input.workspaceId,
    kind: 'competitor',
    label: input.competitor,
    key: competitorKey,
    provenance: input.provenance,
  });

  const event = await upsertCanonicalNode({
    workspaceId: input.workspaceId,
    kind: 'event',
    label: input.title,
    key: normalizeEntityKey(`${competitorKey}-${input.title}`).slice(0, 120),
    props: { summary: input.summary, category: input.category ?? 'other' },
    provenance: input.provenance,
  });

  await upsertEdge({
    workspaceId: input.workspaceId,
    fromNodeId: event.id,
    toNodeId: competitor.id,
    rel: 'timed_as',
    provenance: input.provenance,
  });
  await upsertEdge({
    workspaceId: input.workspaceId,
    fromNodeId: event.id,
    toNodeId: competitor.id,
    rel: 'about',
    provenance: input.provenance,
  });

  await appendDomainEvent({
    workspaceId: input.workspaceId,
    aggregateType: 'competitor',
    aggregateKey: competitorKey,
    eventType: input.category ? `signal.${input.category}` : 'signal.other',
    payload: {
      title: input.title,
      summary: input.summary,
      product: input.product,
      jobId: input.jobId,
    },
    provenance: input.provenance,
  });
}
