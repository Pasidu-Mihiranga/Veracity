'use client';

/**
 * Veracity Intelligence Stories — the reel Home opens on.
 *
 * The pattern is borrowed from social "stories": a row of cards you tap to open
 * a full-screen, auto-advancing viewer. The content, though, is growth
 * intelligence personalised to the user — a synthesised briefing, moves by
 * companies they track, where the market is heading, openings Veracity spotted.
 *
 * The viewer is a carousel: the open story sits centred and lit, while the
 * previous and next stories peek behind it (dimmed and scaled back) to invite
 * the eye onward. You move between stories with the side arrows or by clicking a
 * peeking card, and within a story you tap the card's edges to page through its
 * segments — exactly like a social story, but every page is an intelligence beat.
 *
 * This is UI only. Data comes from lib/mock/home-stories.ts; the CTAs call back
 * out to onAsk() so a "Ask Veracity →" would drop a question into the search box
 * (the one path that would cost anything), but nothing here fetches or generates.
 *
 * Motion is framer-motion (already a dependency). Cards rise in on mount; the
 * carousel springs open and closed, stories slide between slots, segments cross-
 * fade, and a CSS-timed bar auto-advances.
 */

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  X, ChevronLeft, ChevronRight, Plus, ArrowUpRight, ArrowDownRight,
  Sparkles, TrendingUp, Building2, Swords, Target, ArrowRight,
} from 'lucide-react';
import { HOME_STORIES, type Story, type StorySegment, type StoryKind } from '@/lib/mock/home-stories';
import { StoryHero } from '@/components/dashboard/story-art';

/** How long each segment shows before auto-advancing, in ms. */
const SEGMENT_MS = 6000;

const KIND_ICON: Record<StoryKind, typeof Sparkles> = {
  'ai-briefing': Sparkles,
  'company-update': Building2,
  'market-trend': TrendingUp,
  'competitor-move': Swords,
  opportunity: Target,
};

const KIND_LABEL: Record<StoryKind, string> = {
  'ai-briefing': 'Briefing',
  'company-update': 'Company update',
  'market-trend': 'Market trend',
  'competitor-move': 'Competitor move',
  opportunity: 'Opportunity',
};

interface IntelligenceStoriesProps {
  /** Drop a question into the conversation. The only path here that would cost. */
  onAsk?: (query: string) => void;
}

export function IntelligenceStories({ onAsk }: IntelligenceStoriesProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // Cards track locally so a story dims once viewed — mock "seen" state.
  const [seen, setSeen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(HOME_STORIES.map((s) => [s.id, s.seen])),
  );

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  }, []);

  const openStory = (i: number) => {
    setOpenIndex(i);
    markSeen(HOME_STORIES[i].id);
  };

  return (
    <section
      className="rounded-2xl p-5 bg-card border border-border shadow-sm"
      style={{ boxShadow: 'var(--shadow-extruded)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-accent" />
          <h2 className="text-sm font-semibold text-foreground">Your intelligence briefing</h2>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">Updated 2m ago</span>
      </div>

      <div className="flex items-stretch gap-3 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {HOME_STORIES.map((story, i) => (
          <StoryCard
            key={story.id}
            story={story}
            seen={!!seen[story.id]}
            index={i}
            onOpen={() => openStory(i)}
          />
        ))}
        <AddFocusCard index={HOME_STORIES.length} onClick={() => onAsk?.('Track a new company or market for me.')} />
      </div>

      <AnimatePresence>
        {openIndex !== null && (
          <StoryViewer
            stories={HOME_STORIES}
            startIndex={openIndex}
            onClose={() => setOpenIndex(null)}
            onSeen={markSeen}
            onAsk={(q) => { setOpenIndex(null); onAsk?.(q); }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/* ────────────────────────────────────────────────────────── reel cards ──── */

function StoryCard({
  story, seen, index, onOpen,
}: {
  story: Story;
  seen: boolean;
  index: number;
  onOpen: () => void;
}) {
  const Icon = KIND_ICON[story.kind];
  const lead = story.segments[0];

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className="group shrink-0 w-[184px] rounded-2xl p-[1.5px] cursor-pointer text-left"
      style={{
        background: seen
          ? 'var(--border)'
          : `linear-gradient(135deg, ${story.gradient[0]}, ${story.gradient[1]})`,
      }}
    >
      <span className="flex flex-col h-full rounded-[15px] bg-card overflow-hidden">
        {/* Header band, tinted with the story gradient */}
        <span
          className="relative flex items-center gap-2 px-3 py-2.5"
          style={{
            background: `linear-gradient(135deg, ${story.gradient[0]}1F, ${story.gradient[1]}1F)`,
          }}
        >
          <span
            className="grid place-items-center h-8 w-8 rounded-lg shrink-0 text-white"
            style={{ background: `linear-gradient(135deg, ${story.gradient[0]}, ${story.gradient[1]})` }}
          >
            <Icon size={16} />
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
            {KIND_LABEL[story.kind]}
          </span>
          {!seen && (
            <span
              className="ml-auto h-2 w-2 rounded-full shrink-0"
              style={{ background: story.gradient[0] }}
              aria-label="New"
            />
          )}
        </span>

        {/* Body */}
        <span className="flex flex-col gap-1 px-3 pt-2 pb-3 flex-1">
          <span className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
            {story.title}
          </span>
          <span className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
            {lead.headline}
          </span>
          <span className="mt-auto flex items-center justify-between pt-1.5">
            <span className="text-[10px] font-mono text-muted-foreground">{lead.timeAgo}</span>
            <ArrowRight
              size={13}
              className="text-accent opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
            />
          </span>
        </span>
      </span>
    </motion.button>
  );
}

function AddFocusCard({ index, onClick }: { index: number; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3 }}
      className="group shrink-0 w-[184px] rounded-2xl border-2 border-dashed border-border hover:border-accent/50 flex flex-col items-center justify-center gap-2 py-6 cursor-pointer transition-colors"
    >
      <span className="grid place-items-center h-9 w-9 rounded-full bg-muted text-muted-foreground group-hover:text-accent transition-colors">
        <Plus size={20} />
      </span>
      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        Add focus
      </span>
    </motion.button>
  );
}

/* ───────────────────────────────────────────── full-screen carousel viewer ── */

/** Where a story sits relative to the open one. Slots beyond ±1 fade out. */
function slot(offset: number) {
  const abs = Math.abs(offset);
  if (offset === 0) return { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, zIndex: 40 };
  if (abs === 1) return { x: offset * 300, y: 0, rotate: 0, scale: 0.84, opacity: 0.42, zIndex: 30 };
  if (abs === 2) return { x: offset * 380, y: 0, rotate: 0, scale: 0.72, opacity: 0, zIndex: 20 };
  return { x: offset * 440, y: 0, rotate: 0, scale: 0.7, opacity: 0, zIndex: 10 };
}

/*
  The "deck" pose: before the carousel fans open (and after it collapses shut)
  every card is squared up into a small stack at the centre — slightly offset,
  scaled back and fanned by a few degrees, like a pack of cards on a table. Open
  animates deck → slots; close animates slots → deck.
*/
function stacked(offset: number) {
  return {
    x: offset * 14,
    y: 10,
    rotate: offset * 4,
    scale: 0.88,
    opacity: offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.2 : 0,
    zIndex: slot(offset).zIndex,
  };
}

function StoryViewer({
  stories, startIndex, onClose, onSeen, onAsk,
}: {
  stories: Story[];
  startIndex: number;
  onClose: () => void;
  onSeen: (id: string) => void;
  onAsk: (query: string) => void;
}) {
  const [storyIdx, setStoryIdx] = useState(startIndex);
  const [segIdx, setSegIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  // Direction of the last segment move, so segment cross-fades slide correctly.
  const [segDir, setSegDir] = useState(1);
  /*
    `show` drives the deck open/close. Closing sets it false, which lets the
    cards run their exit (collapse back into a stack); onExitComplete then calls
    the real onClose to unmount. So the pack always finishes arranging before the
    viewer disappears, in both directions.
  */
  const [show, setShow] = useState(true);
  const beginClose = useCallback(() => setShow(false), []);

  const story = stories[storyIdx];
  const segment = story.segments[segIdx];

  /*
    Navigation lives entirely in event handlers — never inside a setState
    updater — so no parent state (onSeen) is touched during React's render pass.
    That nesting is what triggered the earlier "cannot update a component while
    rendering a different component" warning.
  */
  const goToStory = useCallback((idx: number) => {
    if (idx < 0 || idx >= stories.length) return;
    setStoryIdx(idx);
    setSegIdx(0);
    setSegDir(1);
    onSeen(stories[idx].id);
  }, [stories, onSeen]);

  // Advance a segment; roll onto the next story when a story's segments run out.
  const advanceSegment = useCallback(() => {
    setSegDir(1);
    if (segIdx + 1 < stories[storyIdx].segments.length) {
      setSegIdx(segIdx + 1);
    } else if (storyIdx + 1 < stories.length) {
      goToStory(storyIdx + 1);
    } else {
      beginClose();
    }
  }, [storyIdx, segIdx, stories, goToStory, beginClose]);

  const backSegment = useCallback(() => {
    setSegDir(-1);
    if (segIdx > 0) {
      setSegIdx(segIdx - 1);
    } else if (storyIdx > 0) {
      const prev = storyIdx - 1;
      setStoryIdx(prev);
      setSegIdx(Math.max(0, stories[prev].segments.length - 1));
    }
  }, [storyIdx, segIdx, stories]);

  // Auto-advance timer, reset whenever the segment/story changes or pause toggles.
  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(advanceSegment, SEGMENT_MS);
    return () => window.clearTimeout(t);
  }, [storyIdx, segIdx, paused, advanceSegment]);

  // Keyboard: ↑/↓ or Shift+←/→ move stories; ←/→ page segments; Esc closes; space pauses.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') beginClose();
      else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
      else if (e.key === 'ArrowRight') e.shiftKey ? goToStory(storyIdx + 1) : advanceSegment();
      else if (e.key === 'ArrowLeft') e.shiftKey ? goToStory(storyIdx - 1) : backSegment();
      else if (e.key === 'ArrowUp') goToStory(storyIdx - 1);
      else if (e.key === 'ArrowDown') goToStory(storyIdx + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advanceSegment, backSegment, goToStory, beginClose, storyIdx]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const atFirst = storyIdx === 0;
  const atLast = storyIdx === stories.length - 1;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'rgba(2, 6, 23, 0.74)', backdropFilter: 'blur(6px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: show ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={beginClose}
    >
      <button
        type="button"
        onClick={beginClose}
        className="absolute top-5 right-5 z-50 grid place-items-center h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
        aria-label="Close"
      >
        <X size={20} />
      </button>

      {/* Story navigation — moves the carousel between stories */}
      <button
        type="button"
        disabled={atFirst}
        onClick={(e) => { e.stopPropagation(); goToStory(storyIdx - 1); }}
        className="hidden sm:grid place-items-center absolute left-6 z-50 h-11 w-11 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-default"
        aria-label="Previous story"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        type="button"
        disabled={atLast}
        onClick={(e) => { e.stopPropagation(); goToStory(storyIdx + 1); }}
        className="hidden sm:grid place-items-center absolute right-6 z-50 h-11 w-11 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-25 disabled:cursor-default"
        aria-label="Next story"
      >
        <ChevronRight size={22} />
      </button>

      {/*
        The carousel. Every story shares one centred grid cell; each card
        animates deck → slot on mount and slot → deck on exit, so opening fans
        the pack out and closing squares it back up. onExitComplete unmounts.
      */}
      <AnimatePresence onExitComplete={onClose}>
        {show && (
          <motion.div
            key="deck"
            className="relative grid place-items-center w-full h-[min(80vh,700px)]"
            onClick={(e) => e.stopPropagation()}
          >
            {stories.map((s, i) => {
              const offset = i - storyIdx;
              if (Math.abs(offset) > 2) {
                // Keep the DOM light. The ±2 ring is rendered but invisible (slot
                // opacity 0) so an incoming neighbour slides/fades in from outside
                // rather than popping into place when you change stories.
                return null;
              }
              const isActive = offset === 0;
              const target = slot(offset);
              return (
                <motion.div
                  key={s.id}
                  className="[grid-area:1/1] w-[min(90vw,400px)] h-full rounded-[26px] overflow-hidden shadow-2xl select-none"
                  style={{
                    background: `linear-gradient(165deg, ${s.gradient[0]} 0%, ${s.gradient[1]} 100%)`,
                    pointerEvents: target.opacity === 0 ? 'none' : 'auto',
                  }}
                  initial={stacked(offset)}
                  animate={target}
                  exit={stacked(offset)}
                  transition={{ type: 'spring', stiffness: 280, damping: 30, delay: Math.abs(offset) * 0.05 }}
                >
                  {isActive ? (
                    <ActiveStory
                      story={s}
                      segIdx={segIdx}
                      segDir={segDir}
                      segment={segment}
                      paused={paused}
                      onAdvance={advanceSegment}
                      onBack={backSegment}
                      onPauseChange={setPaused}
                      onAsk={onAsk}
                    />
                  ) : (
                    <PreviewStory
                      story={s}
                      onClick={() => goToStory(i)}
                    />
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** The lit, interactive centre story: progress bars, tap zones and segment body. */
function ActiveStory({
  story, segIdx, segDir, segment, paused, onAdvance, onBack, onPauseChange, onAsk,
}: {
  story: Story;
  segIdx: number;
  segDir: number;
  segment: StorySegment;
  paused: boolean;
  onAdvance: () => void;
  onBack: () => void;
  onPauseChange: (p: boolean) => void;
  onAsk: (query: string) => void;
}) {
  return (
    <div className="relative h-full w-full">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1.5 p-3">
        {story.segments.map((seg, i) => {
          const state = i < segIdx ? 'done' : i === segIdx ? 'active' : 'todo';
          return (
            <ProgressBar
              // Re-key the active bar per segment so its CSS fill restarts.
              key={state === 'active' ? `active-${segIdx}` : seg.id}
              state={state}
              paused={paused}
              durationMs={SEGMENT_MS}
            />
          );
        })}
      </div>

      {/* Tap zones: edges page segments, centre press-holds to pause */}
      <button type="button" onClick={onBack} className="absolute inset-y-0 left-0 w-[28%] z-10" aria-label="Previous segment" />
      <button type="button" onClick={onAdvance} className="absolute inset-y-0 right-0 w-[28%] z-10" aria-label="Next segment" />
      <div
        className="absolute inset-y-0 left-[28%] right-[28%] z-10"
        onPointerDown={() => onPauseChange(true)}
        onPointerUp={() => onPauseChange(false)}
        onPointerLeave={() => onPauseChange(false)}
      />

      {/* Readability scrim, behind the content and the tap zones */}
      <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-t from-black/60 via-black/15 to-black/30" />

      {/*
        Segment content fills the card top→bottom. The wrapper is pointer-events-
        none so edge/centre taps fall through to the zones above; only the CTA
        re-enables pointer events.
      */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col p-6 pt-14 text-white">
        <AnimatePresence custom={segDir} mode="wait">
          <motion.div
            key={segment.id}
            custom={segDir}
            initial={{ opacity: 0, x: segDir * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: segDir * -28 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <SegmentBody segment={segment} onAsk={onAsk} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** A dimmed neighbour in the carousel — a teaser you click to bring to centre. */
function PreviewStory({ story, onClick }: { story: Story; onClick: () => void }) {
  const Icon = KIND_ICON[story.kind];
  const lead = story.segments[0];
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative h-full w-full text-left text-white cursor-pointer"
      aria-label={`Open ${story.title}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 pb-7 gap-2">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center h-7 w-7 rounded-full bg-white/20 backdrop-blur">
            <Icon size={14} />
          </span>
          <span className="text-[11px] font-mono uppercase tracking-wider text-white/90">
            {KIND_LABEL[story.kind]}
          </span>
        </div>
        <p className="text-[11px] font-mono uppercase tracking-wider text-white/70">{lead.eyebrow}</p>
        <h3 className="text-xl font-bold leading-tight line-clamp-2">{lead.headline}</h3>
      </div>
    </button>
  );
}

function SegmentBody({ segment, onAsk }: { segment: StorySegment; onAsk: (q: string) => void }) {
  const Icon = KIND_ICON[segment.kind];
  const delta = segment.metric?.delta;
  const Trend = delta === undefined ? null : delta >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="flex h-full flex-col">
      {/* Top header — pins the kind + time to the top of the card */}
      <div className="flex items-center gap-2">
        <span className="grid place-items-center h-7 w-7 rounded-full bg-white/20 backdrop-blur">
          <Icon size={14} />
        </span>
        <span className="text-[11px] font-mono uppercase tracking-wider text-white/90">
          {KIND_LABEL[segment.kind]}
        </span>
        <span className="ml-auto text-[11px] font-mono text-white/70">{segment.timeAgo}</span>
      </div>

      {/*
        Hero — a kind-appropriate illustration filling what used to be dead space
        between the header and the copy, so the top of every card reads as an
        intentional image rather than an empty gradient.
      */}
      <div className="relative my-3 min-h-0 flex-1">
        <StoryHero kind={segment.kind} id={segment.id} />
      </div>

      {/* Bottom copy */}
      <div className="flex flex-col gap-2.5">
        <p className="text-[11px] font-mono uppercase tracking-wider text-white/70">
          {segment.eyebrow}
        </p>
        <h3 className="text-2xl font-bold leading-tight">{segment.headline}</h3>
        <p className="text-sm leading-relaxed text-white/90 line-clamp-4">{segment.body}</p>

        {segment.metric && (
          <div className="self-start flex flex-col rounded-2xl bg-white/12 backdrop-blur px-4 py-2.5 border border-white/15">
            <span className="text-[10px] font-mono uppercase tracking-wide text-white/70">
              {segment.metric.label}
            </span>
            <span className="flex items-center gap-1 text-xl font-bold tabular-nums">
              {segment.metric.value}
              {Trend && <Trend size={16} className="text-white/90" />}
            </span>
          </div>
        )}

        {segment.cta && (
          <button
            type="button"
            onClick={() => onAsk(segment.cta!.query)}
            className="pointer-events-auto mt-1 self-start flex items-center gap-2 rounded-full bg-white text-slate-900 text-sm font-semibold px-4 py-2.5 hover:bg-white/90 transition-colors cursor-pointer shadow-lg"
          >
            {segment.cta.label}
            <ArrowRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * One segment's timer bar. `active` fills over `durationMs` via a CSS keyframe;
 * `done` is full, `todo` empty. The parent re-keys the active bar on every
 * segment change, which restarts the animation from zero; `paused` freezes it
 * in place. Pure CSS — no state, no effect.
 */
function ProgressBar({
  state, paused, durationMs,
}: {
  state: 'done' | 'active' | 'todo';
  paused: boolean;
  durationMs: number;
}) {
  return (
    <div className="h-[3px] flex-1 rounded-full bg-white/30 overflow-hidden">
      <div
        className="h-full rounded-full bg-white"
        style={
          state === 'active'
            ? {
                width: 0,
                animation: `story-fill ${durationMs}ms linear forwards`,
                animationPlayState: paused ? 'paused' : 'running',
              }
            : { width: state === 'done' ? '100%' : 0 }
        }
      />
    </div>
  );
}
