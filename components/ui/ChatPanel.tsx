'use client';

import type { RefObject } from 'react';
import Image from 'next/image';
import {
  ArrowUpRight, ChevronDown, ChevronRight, Layers, MessageSquarePlus, Paperclip,
  RefreshCw, Search, Send, X,
} from 'lucide-react';
import type { AttachedImage, FollowUp } from '@/types/chat-ui';
import { DEMO_QUERIES } from '@/lib/domain-meta';
import type { ResearchTurnMode } from '@/lib/research-turn-mode';

export type ChatPanelProps = {
  /** Empty-state + suggestions (when no messages). */
  showEmptyState: boolean;
  onDemoQuery: (query: string) => void;
  /** Follow-up thread under results. */
  followUps: FollowUp[];
  isFollowingUp: boolean;
  isLoading: boolean;
  followUpEndRef?: RefObject<HTMLDivElement | null>;
  /** Floating composer. */
  showComposer: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: (text: string) => void;
  composerPlaceholder?: string;
  attachedImages: AttachedImage[];
  onRemoveImage: (index: number) => void;
  onAttachClick: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onTextareaInput: () => void;
  viewMode?: import('@/types/chat-ui').ProductViewMode;
  onViewModeChange?: (mode: import('@/types/chat-ui').ProductViewMode) => void;
  turnMode?: ResearchTurnMode;
  onTurnModeChange?: (mode: ResearchTurnMode) => void;
  headerBg: string;
  cardBg: string;
  cardBg2: string;
  textMain: string;
  textMuted: string;
  textSubtle: string;
  accentInk: string;
  neuExtruded: string;
  neuExtrudedSm: string;
  isDark: boolean;
};

export function ChatPanel({
  showEmptyState,
  onDemoQuery,
  followUps,
  isFollowingUp,
  isLoading,
  followUpEndRef,
  showComposer,
  inputValue,
  onInputChange,
  onSend,
  composerPlaceholder = 'Ask a growth intelligence question…',
  attachedImages,
  onRemoveImage,
  onAttachClick,
  fileInputRef,
  onFileChange,
  textareaRef,
  onTextareaInput,
  viewMode = 'executive',
  onViewModeChange,
  turnMode = 'verify',
  onTurnModeChange,
  headerBg,
  cardBg,
  cardBg2,
  textMain,
  textMuted,
  textSubtle,
  accentInk,
  neuExtruded,
  neuExtrudedSm,
  isDark,
}: ChatPanelProps) {
  const composerBusy = isLoading || isFollowingUp;

  return (
    <>
      {showEmptyState && (
        <div className="flex flex-col lg:flex-row items-center lg:items-center justify-center gap-6 sm:gap-10 lg:gap-14 min-h-[50vh] sm:min-h-[58vh] px-2 sm:px-4 w-full max-w-5xl mx-auto py-4">
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-md">
            <Image
              src="/robot.avif"
              alt=""
              width={140}
              height={148}
              className="brand-mascot w-20 sm:w-[7.5rem] h-auto mb-3 sm:mb-5 animate-float drop-shadow-md"
              draggable={false}
            />
            <p className="label-mono mb-2 sm:mb-3 flex justify-center lg:justify-start">Boardroom brief in minutes</p>
            <h2 className="empty-heading mb-2 sm:mb-3 text-xl sm:text-2xl font-bold">Ask a growth question</h2>
            <p className="text-xs sm:text-[14px] leading-relaxed" style={{ color: textMuted }}>
              Six specialist agents pull live signals, score confidence, and render findings inline — not as chat walls.
            </p>
          </div>

          <div className="flex-1 flex flex-col gap-2.5 w-full max-w-xl">
            {DEMO_QUERIES.map(q => (
              <button key={q} type="button" onClick={() => onDemoQuery(q)} className="suggest-row text-xs sm:text-sm p-3">
                <span className="suggest-row-icon shrink-0">
                  <Search size={14} />
                </span>
                <span className="flex-1 demo-query-text text-left line-clamp-2">{q}</span>
                <ChevronRight size={14} style={{ color: textSubtle, flexShrink: 0 }} />
              </button>
            ))}
            <div className="flex flex-col gap-2 mt-2">
              <p className="label-mono text-left">Generalize to another product</p>
              <button
                type="button"
                onClick={() => onDemoQuery('What should Clay build or reposition over the next six months to capture emerging demand?')}
                className="suggest-row text-xs sm:text-sm p-3"
              >
                <span className="suggest-row-icon shrink-0">
                  <Layers size={14} />
                </span>
                <span className="flex-1 demo-query-text text-left line-clamp-2">
                  What should Clay build or reposition over the next six months to capture emerging demand?
                </span>
                <ChevronRight size={14} style={{ color: textSubtle, flexShrink: 0 }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {followUps.map(fu => (
        <div
          key={fu.id}
          className="rounded-lg overflow-hidden"
          style={{
            boxShadow: `${neuExtrudedSm}, inset 2px 0 0 0 ${accentInk}`,
            background: cardBg,
          }}
        >
          <div className="flex items-center gap-2.5 px-3 sm:px-4 py-2.5 sm:py-3" style={{ borderBottom: 'none' }}>
            <MessageSquarePlus size={13} style={{ color: accentInk }} />
            <p className="text-xs sm:text-[13px] font-mono" style={{ color: textMain }}>{fu.question}</p>
          </div>
          <div className="p-3 sm:p-4">
            {fu.loading ? (
              <div className="flex flex-col gap-2">
                <div className="h-3 rounded skeleton w-3/4" />
                <div className="h-3 rounded skeleton w-full" style={{ animationDelay: '0.2s' }} />
                <div className="h-3 rounded skeleton w-5/6" style={{ animationDelay: '0.4s' }} />
              </div>
            ) : (
              <>
                <p className="followup-answer whitespace-pre-line text-xs sm:text-sm">{fu.answer}</p>
                {fu.sources && fu.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: 'none' }}>
                    {fu.sources.map(s => (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded transition-colors"
                        style={{ background: cardBg2, boxShadow: neuExtrudedSm, border: 'none', color: textMuted }}
                      >
                        {s.title} <ArrowUpRight size={8} />
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ))}
      {followUps.length > 0 && <div ref={followUpEndRef} />}

      {showComposer && (
        <div className="shrink-0 z-20 px-2 sm:px-4 md:px-8 pb-3 sm:pb-6 pt-1 sm:pt-2 pointer-events-none">
          <div className="pointer-events-auto max-w-[920px] mx-auto w-full">
            {attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 px-1">
                {attachedImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <Image
                      src={img.dataUrl}
                      alt={img.name}
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10 object-cover rounded-lg"
                      style={{ border: 'none', boxShadow: neuExtrudedSm }}
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: isDark ? '#333' : '#666', color: '#fff' }}
                    >
                      <X size={9} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              className={`query-bar-glow query-bar-float query-composer flex w-full flex-col ${
                inputValue.includes('\n') || inputValue.length > 80 ? 'query-composer--expanded' : ''
              }`}
              style={{ background: headerBg }}
            >
              <div className="query-composer-input flex min-w-0 items-start gap-2 sm:gap-2.5 px-3 pt-3 sm:px-4 sm:pt-4">
                <Search
                  size={15}
                  className="mt-1 sm:mt-1.5 shrink-0 pointer-events-none"
                  style={{ color: textSubtle }}
                  aria-hidden
                />
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={e => { onInputChange(e.target.value); onTextareaInput(); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!composerBusy) onSend(inputValue);
                    }
                  }}
                  placeholder={composerPlaceholder}
                  className="query-textarea min-w-0 flex-1 bg-transparent outline-none focus:outline-none focus-visible:outline-none font-sans text-sm sm:text-base"
                  style={{ color: textMain }}
                  disabled={composerBusy}
                  rows={1}
                />
              </div>

              <div className="query-composer-toolbar flex flex-wrap items-center justify-between gap-2 px-3 pb-2.5 pt-1.5 sm:px-3.5 sm:pb-3.5 sm:pt-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onAttachClick}
                    className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl bg-accent/5 hover:bg-accent/12 border border-border/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-2xs hover:border-accent/30"
                    aria-label="Attach image"
                    disabled={composerBusy}
                  >
                    <Paperclip size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onSend(inputValue)}
                  disabled={(!inputValue.trim() && attachedImages.length === 0) || composerBusy}
                  className="bg-gradient-signature flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-[13px] font-medium disabled:opacity-35 shrink-0 cursor-pointer"
                  aria-label="Send"
                >
                  {composerBusy
                    ? <RefreshCw size={14} className="animate-spin" />
                    : <Send size={14} />}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onFileChange}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
