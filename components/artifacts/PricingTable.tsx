'use client';

import React from 'react';
import { UnassessedBadge } from './UnassessedBadge';
import type { PricingOutput } from '@/lib/agents/types';

interface Props {
  output: PricingOutput;
}

const WTP_CONFIG = {
  premium:         { label: 'Premium Market',     class: 'text-accent bg-accent/10 border-accent/20' },
  'mid-market':    { label: 'Mid-Market',          class: 'text-accent-secondary bg-accent-secondary/10 border-accent-secondary/20' },
  'price-sensitive': { label: 'Price Sensitive',   class: 'text-navy bg-navy/10 border-navy/20 dark:text-ice dark:bg-ice/10 dark:border-ice/20' },
};

export function PricingTable({ output }: Props) {
  const competitorPricing = output.competitorPricing ?? [];
  const willingnessToPay = output.willingnessToPay;
  const pricingSignals = output.pricingSignals ?? [];
  const recommendation = output.recommendation;
  const wtp = willingnessToPay ? WTP_CONFIG[willingnessToPay] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Pricing Intelligence</div>
        {wtp ? (
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${wtp.class}`}>
            {wtp.label}
          </span>
        ) : (
          <UnassessedBadge label="Willingness to pay" />
        )}
      </div>

      {/* Competitor pricing tiers */}
      {competitorPricing.length > 0 && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {competitorPricing.map((tier, i) => (
            <div key={i} className="v-card p-4 flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-foreground text-sm">{tier.tierName}</span>
                <span className="font-mono text-accent text-sm font-bold">{tier.price}</span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">{tier.targetSegment}</p>
              {tier.features.length > 0 && (
                <ul className="flex flex-col gap-0.5 mt-1">
                  {tier.features.slice(0, 4).map((f, fi) => (
                    <li key={fi} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-[color:var(--accent)] shrink-0">✓</span>{f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pricing signals */}
      {pricingSignals.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">Buyer Pricing Signals</p>
          {pricingSignals.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-accent shrink-0 mt-0.5">›</span>
              <span className="leading-snug">{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
          <p className="text-[10px] font-mono uppercase text-accent tracking-wider mb-1">Pricing Recommendation</p>
          <p className="text-sm text-foreground leading-relaxed">{recommendation}</p>
        </div>
      )}
    </div>
  );
}
