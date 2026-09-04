/**
 * Centralized Typography System for Veracity UI.
 *
 * Enforces a high-contrast, perfectly legible 3-tier font hierarchy:
 *
 *  - Tier 1: Page Headings & Core Titles (22px – 28px)
 *  - Tier 2: Section Labels, Card Headers & Input Titles (13px – 16px)
 *  - Tier 3: Body Descriptions, Captions & Subtext (13px – 14.5px)
 */

export const TYPOGRAPHY = {
  // Tier 1: Headings & Main Titles
  headingPage: 'font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight',
  headingCard: 'font-display text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug',
  headingSub: 'font-display text-base sm:text-lg font-bold tracking-tight text-foreground',

  // Tier 2: Section Labels, Input Titles & Key Badges
  sectionLabel: 'font-mono text-xs sm:text-[12.5px] font-bold uppercase tracking-wider text-muted-foreground',
  inputLabel: 'font-mono text-xs sm:text-[12.5px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block',
  cardTitle: 'font-display text-sm sm:text-base font-bold text-foreground',

  // Tier 3: Body Text & Captions
  body: 'text-sm sm:text-[14.5px] font-normal text-foreground leading-relaxed',
  bodyMuted: 'text-xs sm:text-sm font-normal text-muted-foreground leading-relaxed',
  caption: 'text-xs sm:text-[13px] font-medium text-muted-foreground leading-normal',
  monoMeta: 'font-mono text-xs font-medium text-muted-foreground',
} as const;
