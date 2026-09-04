'use client';

/**
 * The market we already hold, rendered inside the conversation.
 *
 * A comparison of two companies used to come back as a grid of "not established
 * by retrieved evidence", because a live web sweep in sixty seconds cannot
 * establish much about anyone. When the question is about companies this
 * workspace has months of collected history on, the answer should lead with that
 * history — who holds the market, which way it is moving, what each side
 * actually did — and let the sweep add whatever is newer than our last read.
 *
 * Renders nothing at all when the query named nobody we follow, so the ordinary
 * research path is untouched.
 */

import type { MarketBriefingPayload } from '@/lib/agents/types';
import {
  ComparisonTable, DecisionTimeline, MarketShareDonut, ShareTrend,
} from '@/components/artifacts/MarketCharts';

export function MarketBriefingSection({
  briefing,
}: {
  briefing?: MarketBriefingPayload;
}) {
  if (!briefing || briefing.companies.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="veracity-card p-5 flex flex-col gap-2">
        <p className="ui-section-label text-muted-foreground">
          {briefing.label} · {briefing.geography}
        </p>
        <p className="text-sm text-foreground leading-relaxed">{briefing.readOut}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <MarketShareDonut
          slices={briefing.shareNow}
          basis="Share of the market, latest month. Everyone we do not name individually is grouped."
        />
        <div className="veracity-card p-5 flex flex-col gap-2">
          <h3 className="text-base font-semibold text-foreground">Where this is heading</h3>
          <p className="text-sm text-foreground">{briefing.outlook.call}</p>
          <p className="text-sm text-muted-foreground">Because {briefing.outlook.because}</p>
          <p className="text-sm text-muted-foreground">
            We would change our mind if {briefing.outlook.breaksIf}
          </p>
        </div>
      </div>

      <ShareTrend
        months={briefing.months}
        companies={briefing.companies}
        projection={briefing.projection}
      />

      <ComparisonTable companies={briefing.companies} />

      <DecisionTimeline items={briefing.timeline} limit={8} />

      {briefing.regulations.length > 0 && (
        <div className="veracity-card p-5 flex flex-col gap-3">
          <h3 className="text-base font-semibold text-foreground">Rules that affect this</h3>
          <ul className="flex flex-col gap-3">
            {briefing.regulations.map((rule) => (
              <li key={rule.headline} className="flex flex-col gap-0.5">
                <p className="text-xs text-muted-foreground">
                  {new Date(`${rule.month}-01T00:00:00Z`).toLocaleDateString('en-GB', {
                    month: 'long', year: 'numeric', timeZone: 'UTC',
                  })}
                  {' · '}{rule.authority}
                </p>
                <p className="text-sm font-medium text-foreground">{rule.headline}</p>
                <p className="text-sm text-muted-foreground">{rule.soWhat}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
