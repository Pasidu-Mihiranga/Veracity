'use client';

import { getSourceTrustTier, type SourceTrustTier } from '@/lib/tools/source-validator';

const TIER_CLASS: Record<SourceTrustTier, string> = {
  T1: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  T2: 'bg-accent/5 text-accent border-accent/20',
  T3: 'bg-muted text-muted-foreground border-border',
};

type Props = {
  url: string;
  productDomains?: string[];
  competitorDomains?: string[];
};

export function SourceTrustBadge({ url, productDomains, competitorDomains }: Props) {
  const tier = getSourceTrustTier(url, { productDomains, competitorDomains });
  return (
    <span
      className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${TIER_CLASS[tier]}`}
      title={
        tier === 'T1'
          ? 'Trusted press / analyst / review'
          : tier === 'T2'
            ? 'Community or primary domain'
            : 'Other valid source'
      }
    >
      {tier}
    </span>
  );
}
