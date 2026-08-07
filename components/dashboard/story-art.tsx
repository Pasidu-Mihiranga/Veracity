'use client';

/**
 * Hero illustrations for the story viewer.
 *
 * Each StoryKind gets a bespoke line-art scene that fills the top of the card —
 * an "image" for the section that reads as intelligence rather than a generic
 * squiggle. Pure inline SVG (white on the card's gradient), so it is self-
 * contained, crisp at any size, and needs no external asset or CSP exception.
 *
 * `id` must be unique per rendered hero: it namespaces the SVG <defs> so two
 * heroes on screen at once (e.g. during a segment cross-fade) never share a
 * gradient. Pass the segment id.
 */

import type { StoryKind } from '@/lib/mock/home-stories';

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-glow`} cx="50%" cy="42%" r="62%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.26" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0.03" />
      </linearGradient>
    </defs>
  );
}

function Scene({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 400 240"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-hidden
    >
      <Defs id={id} />
      <rect x="0" y="0" width="400" height="240" fill={`url(#${id}-glow)`} />
      {children}
    </svg>
  );
}

/** AI briefing — a synthesised digest: a document with lines, ringed by sparkles. */
function BriefingArt({ id }: { id: string }) {
  return (
    <Scene id={id}>
      <rect x="120" y="66" width="160" height="112" rx="16" fill={`url(#${id}-fill)`} stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
      <g stroke="#fff" strokeLinecap="round">
        <line x1="142" y1="98" x2="250" y2="98" strokeOpacity="0.6" strokeWidth="5" />
        <line x1="142" y1="122" x2="258" y2="122" strokeOpacity="0.35" strokeWidth="5" />
        <line x1="142" y1="146" x2="214" y2="146" strokeOpacity="0.35" strokeWidth="5" />
      </g>
      <path d="M296 54 l6 15 15 6 -15 6 -6 15 -6 -15 -15 -6 15 -6z" fill="#fff" fillOpacity="0.9" />
      <path d="M112 150 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z" fill="#fff" fillOpacity="0.6" />
      <circle cx="300" cy="176" r="3.5" fill="#fff" fillOpacity="0.5" />
    </Scene>
  );
}

/** Company update — growth: rising bars with an upward arrow. */
function CompanyArt({ id }: { id: string }) {
  return (
    <Scene id={id}>
      <g fill={`url(#${id}-fill)`} stroke="#fff" strokeOpacity="0.5" strokeWidth="2">
        <rect x="96" y="150" width="40" height="52" rx="6" />
        <rect x="150" y="118" width="40" height="84" rx="6" />
        <rect x="204" y="86" width="40" height="116" rx="6" />
      </g>
      <path d="M262 130 L322 78" stroke="#fff" strokeOpacity="0.85" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M300 74 L326 72 L322 98" stroke="#fff" strokeOpacity="0.85" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Scene>
  );
}

/** Market trend — a rising area line across gridlines, with a glowing end point. */
function TrendArt({ id }: { id: string }) {
  const line = 'M40 178 C 92 150, 120 108, 162 130 S 228 92, 270 110 S 330 58, 360 70';
  return (
    <Scene id={id}>
      <g stroke="#fff" strokeOpacity="0.12" strokeWidth="1.5">
        <line x1="40" y1="86" x2="360" y2="86" />
        <line x1="40" y1="132" x2="360" y2="132" />
        <line x1="40" y1="178" x2="360" y2="178" />
      </g>
      <path d={`${line} L360 200 L40 200 Z`} fill={`url(#${id}-fill)`} />
      <path d={line} fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round" />
      <circle cx="360" cy="70" r="12" fill="#fff" fillOpacity="0.22" />
      <circle cx="360" cy="70" r="6" fill="#fff" />
    </Scene>
  );
}

/** Competitor move — an action arrow answered by a reaction arrow. */
function CompetitorArt({ id }: { id: string }) {
  return (
    <Scene id={id}>
      <circle cx="112" cy="100" r="12" fill={`url(#${id}-fill)`} stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
      <circle cx="288" cy="150" r="12" fill={`url(#${id}-fill)`} stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3">
        <path d="M128 100 H252" stroke="#fff" strokeOpacity="0.8" />
        <path d="M238 88 L256 100 L238 112" stroke="#fff" strokeOpacity="0.8" />
        <path d="M272 150 H148" stroke="#fff" strokeOpacity="0.45" />
        <path d="M162 138 L144 150 L162 162" stroke="#fff" strokeOpacity="0.45" />
      </g>
    </Scene>
  );
}

/** Opportunity — a target: concentric rings, a crosshair and a locating dot. */
function OpportunityArt({ id }: { id: string }) {
  return (
    <Scene id={id}>
      <g fill="none" stroke="#fff">
        <circle cx="200" cy="120" r="74" strokeOpacity="0.22" strokeWidth="2" />
        <circle cx="200" cy="120" r="48" strokeOpacity="0.4" strokeWidth="2" />
        <circle cx="200" cy="120" r="24" strokeOpacity="0.6" strokeWidth="2" />
      </g>
      <g stroke="#fff" strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round">
        <line x1="200" y1="26" x2="200" y2="58" />
        <line x1="200" y1="182" x2="200" y2="214" />
        <line x1="86" y1="120" x2="118" y2="120" />
        <line x1="282" y1="120" x2="314" y2="120" />
      </g>
      <circle cx="200" cy="120" r="15" fill="#fff" fillOpacity="0.2" />
      <circle cx="200" cy="120" r="7" fill="#fff" />
    </Scene>
  );
}

const ART: Record<StoryKind, (props: { id: string }) => React.JSX.Element> = {
  'ai-briefing': BriefingArt,
  'company-update': CompanyArt,
  'market-trend': TrendArt,
  'competitor-move': CompetitorArt,
  opportunity: OpportunityArt,
};

/** The hero illustration for a story segment, chosen by its kind. */
export function StoryHero({ kind, id }: { kind: StoryKind; id: string }) {
  const Art = ART[kind];
  return <Art id={id} />;
}
