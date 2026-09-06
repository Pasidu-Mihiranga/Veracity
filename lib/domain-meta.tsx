import React from 'react';
import {
  TrendingUp, Swords, Trophy, DollarSign, Megaphone, Telescope, Rocket, Fish,
} from 'lucide-react';

/**
 * Example questions on the empty state.
 *
 * Deliberately Sri Lankan companies with a real public footprint — pricing
 * pages, app listings, press coverage — so a first run has something to actually
 * read. The previous set named "Lilian" and "Vector Agents", which returned a
 * McLean, Virginia real-estate business and nothing respectively, so the first
 * thing a new user saw was a wall of "unsupported".
 *
 * These are examples, not defaults: the product works on any company.
 */
export const DEMO_QUERIES = [
  'How is Dialog Axiata positioned against SLT-Mobitel right now?',
  'Compare PickMe and Uber in the Sri Lankan ride-hailing market.',
  'Compare Commercial Bank and Sampath Bank in digital banking and deposit growth.',
  'Compare Dilmah and Akbar Brothers in value-added Ceylon tea export.',
  'Compare MAS Holdings and Brandix in sustainable technical apparel manufacturing.',
];

export const ALL_DOMAINS = [
  'market-trends',
  'competitive',
  'win-loss',
  'pricing',
  'positioning',
  'adjacent',
  'execution-engine',
  'mirofish',
  'mirofish-live',
] as const;

export type Domain = (typeof ALL_DOMAINS)[number];

export type DomainMeta = {
  label: string;
  short: string;
  icon: React.ReactNode;
  color: string;
  colorLight: string;
  bg: string;
  bgLight: string;
  border: string;
};

export const DOMAIN_META: Record<Domain, DomainMeta> = {
  'market-trends': {
    label: 'Market & Trend Sensing',
    short: 'Market Trends',
    icon: <TrendingUp size={14} />,
    color: '#00C4FF',
    colorLight: '#0052A3',
    bg: 'rgba(0,196,255,0.12)',
    bgLight: 'rgba(0,82,163,0.1)',
    border: 'rgba(0,82,163,0.35)',
  },
  competitive: {
    label: 'Competitive Landscape',
    short: 'Competitive',
    icon: <Swords size={14} />,
    color: '#3D9EFF',
    colorLight: '#1A5A9A',
    bg: 'rgba(61,158,255,0.12)',
    bgLight: 'rgba(26,90,154,0.1)',
    border: 'rgba(26,90,154,0.35)',
  },
  'win-loss': {
    label: 'Win / Loss Intelligence',
    short: 'Win / Loss',
    icon: <Trophy size={14} />,
    color: '#7EC8FF',
    colorLight: '#0B4F8C',
    bg: 'rgba(126,200,255,0.12)',
    bgLight: 'rgba(11,79,140,0.1)',
    border: 'rgba(11,79,140,0.35)',
  },
  pricing: {
    label: 'Pricing & Packaging',
    short: 'Pricing',
    icon: <DollarSign size={14} />,
    color: '#2A7FD4',
    colorLight: '#0B4F8C',
    bg: 'rgba(42,127,212,0.12)',
    bgLight: 'rgba(11,79,140,0.1)',
    border: 'rgba(11,79,140,0.35)',
  },
  positioning: {
    label: 'Positioning & Messaging',
    short: 'Positioning',
    icon: <Megaphone size={14} />,
    color: '#1A5A9A',
    colorLight: '#063A6B',
    bg: 'rgba(26,90,154,0.12)',
    bgLight: 'rgba(6,58,107,0.1)',
    border: 'rgba(6,58,107,0.35)',
  },
  adjacent: {
    label: 'Adjacent Market Collision',
    short: 'Adjacent',
    icon: <Telescope size={14} />,
    color: '#5AB0E8',
    colorLight: '#1A5A9A',
    bg: 'rgba(90,176,232,0.12)',
    bgLight: 'rgba(26,90,154,0.1)',
    border: 'rgba(26,90,154,0.35)',
  },
  'execution-engine': {
    label: 'Execution Engine',
    short: 'Execution',
    icon: <Rocket size={14} />,
    color: '#00C4FF',
    colorLight: '#0052A3',
    bg: 'rgba(0,196,255,0.12)',
    bgLight: 'rgba(0,82,163,0.1)',
    border: 'rgba(0,82,163,0.35)',
  },
  mirofish: {
    label: 'Swarm Decision Lab',
    short: 'Scenario Lab',
    icon: <Fish size={14} />,
    color: '#9ED8FF',
    colorLight: '#0B4F8C',
    bg: 'rgba(158,216,255,0.14)',
    bgLight: 'rgba(11,79,140,0.1)',
    border: 'rgba(11,79,140,0.4)',
  },
  'mirofish-live': {
    label: 'Swarm Decision Lab (Live)',
    short: 'Live Scenario',
    icon: <Fish size={14} />,
    color: '#1A5A9A',
    colorLight: '#063A6B',
    bg: 'rgba(0,196,255,0.1)',
    bgLight: 'rgba(6,58,107,0.1)',
    border: 'rgba(6,58,107,0.3)',
  },
};

export function domainAccent(
  meta: { color: string; colorLight: string },
  isDark: boolean,
): string {
  return isDark ? meta.color : meta.colorLight;
}
