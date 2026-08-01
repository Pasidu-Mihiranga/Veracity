'use client';

import { useCallback, useEffect, useState } from 'react';
import { featureFlags } from '@/lib/feature-flags';

type Profile = {
  competitor_key: string;
  display_name: string;
  summary: string;
  trend_headline: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

type EventRow = {
  event_type: string;
  payload: Record<string, unknown>;
  occurred_at: string;
};

type Props = {
  competitorKey?: string | null;
  compact?: boolean;
};

export function CompetitorProfileCard({ competitorKey, compact }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [detail, setDetail] = useState<{ profile: Profile | null; events: EventRow[] } | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!featureFlags.competitorProfiles && !featureFlags.continuousIntelligence) return;
    if (competitorKey) {
      const res = await fetch(
        `/api/competitors?key=${encodeURIComponent(competitorKey)}`,
        { credentials: 'include' },
      );
      if (!res.ok) return;
      const data = await res.json();
      setDetail({ profile: data.profile, events: data.events ?? [] });
      return;
    }
    const res = await fetch('/api/competitors', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    setProfiles(data.competitors ?? []);
  }, [competitorKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!featureFlags.competitorProfiles && !featureFlags.continuousIntelligence) return null;

  if (competitorKey && detail?.profile) {
    const p = detail.profile;
    return (
      <div className="veracity-card p-4 flex flex-col gap-2">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Competitor profile
        </div>
        <div className="text-sm font-serif">{p.display_name}</div>
        {p.trend_headline && (
          <div className="text-[11px] font-mono text-accent">{p.trend_headline}</div>
        )}
        <p className="text-xs text-muted-foreground">{p.summary}</p>
        {!compact && (
          <ul className="text-[11px] font-mono space-y-1 mt-2">
            {detail.events.slice(-8).reverse().map((e, i) => (
              <li key={`${e.occurred_at}-${i}`} className="border-b border-border pb-1">
                <span className="text-muted-foreground">
                  {new Date(e.occurred_at).toLocaleDateString()}
                </span>{' '}
                {String(e.payload.title ?? e.event_type)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (!profiles.length) {
    return (
      <div className="text-xs text-muted-foreground font-mono">
        No competitor profiles projected yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {profiles.slice(0, compact ? 3 : 12).map((p) => (
        <div key={p.competitor_key} className="veracity-card p-3">
          <div className="text-sm font-medium">{p.display_name}</div>
          {p.trend_headline && (
            <div className="text-[10px] font-mono text-accent mt-0.5">{p.trend_headline}</div>
          )}
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.summary}</p>
        </div>
      ))}
    </div>
  );
}
