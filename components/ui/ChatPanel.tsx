'use client';

import type { RefObject } from 'react';
import {
  ArrowUpRight, ChevronRight, Layers, MessageSquarePlus, Paperclip,
  RefreshCw, Search, Send, X,
} from 'lucide-react';
import type { AttachedImage, FollowUp } from '@/types/chat-ui';
import { DEMO_QUERIES } from '@/lib/domain-meta';

export type ChatPanelProps = {
  /** Empty-state + suggestions (when no messages). */
  showEmptyState: boolean;
  onDemoQuery: (query: string) => void;
  /** Follow-up thread under results. */
  followUps: FollowUp[];
  followUpInput: string;
  onFollowUpInputChange: (value: string) => void;
  onFollowUp: (text: string) => void;
  isFollowingUp: boolean;
  isLoading: boolean;
  hasResult: boolean;
  followUpEndRef: RefObject<HTMLDivElement | null>;
  /** Floating composer. */
  showComposer: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: (text: string) => void;
  attachedImages: AttachedImage[];
  onRemoveImage: (index: number) => void;
  onAttachClick: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onTextareaInput: () => void;
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
  followUpInput,
  onFollowUpInputChange,
  onFollowUp,
  isFollowingUp,
  isLoading,
  hasResult,
  followUpEndRef,
  showComposer,
  inputValue,
  onInputChange,
  onSend,
  attachedImages,
  onRemoveImage,
  onAttachClick,
  fileInputRef,
  onFileChange,
  textareaRef,
  onTextareaInput,
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
  return (
    <>
      {showEmptyState && (
        <div className="flex flex-col lg:flex-row items-center lg:items-center justify-center gap-10 lg:gap-14 min-h-[58vh] px-2 w-full max-w-5xl mx-auto">
          <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-md">
            <img
              src="/robot.avif"
              alt=""
              width={140}
              height={148}
              className="brand-mascot w-[7.5rem] h-auto mb-5 animate-float drop-shadow-md"
              draggable={false}
            />
            <p className="label-mono mb-3 flex justify-center lg:justify-start">Boardroom brief in minutes</p>
            <h2 className="empty-heading mb-3">Ask a growth question</h2>
            <p className="text-[14px] leading-relaxed" style={{ color: textMuted }}>
              Six specialist agents pull live signals, score confidence, and render findings inline — not as chat walls.
            </p>
          </div>

          <div className="flex-1 flex flex-col gap-2.5 w-full max-w-xl">
            {DEMO_QUERIES.map(q => (
              <button key={q} type="button" onClick={() => onDemoQuery(q)} className="suggest-row">
                <span className="neu-well w-8 h-8 shrink-0">
                  <Search size={13} className="text-accent" />
                </span>
                <span className="flex-1 demo-query-text text-left">{q}</span>
                <ChevronRight size={14} style={{ color: textSubtle, flexShrink: 0 }} />
              </button>
            ))}
            <div className="flex flex-col gap-2 mt-2">
              <p className="label-mono text-left">Generalize to another product</p>
              <button
                type="button"
                onClick={() => onDemoQuery('What should Clay build or reposition over the next six months to capture emerging demand?')}
                className="suggest-row"
              >
                <span className="neu-well w-8 h-8 shrink-0">
                  <Layers size={13} className="text-accent" />
                </span>
                <span className="flex-1 demo-query-text text-left">
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
            border: 'none',
            boxShadow: neuExtrudedSm,
            borderLeft: `2px solid ${accentInk}`,
            background: cardBg,
          }}
        >
          <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: 'none' }}>
            <MessageSquarePlus size={13} style={{ color: accentInk }} />
            <p className="text-[13px] font-mono" style={{ color: textMain }}>{fu.question}</p>
          </div>
          <div className="p-4">
            {fu.loading ? (
              <div className="flex flex-col gap-2">
                <div className="h-3 rounded skeleton w-3/4" />
                <div className="h-3 rounded skeleton w-full" style={{ animationDelay: '0.2s' }} />
                <div className="h-3 rounded skeleton w-5/6" style={{ animationDelay: '0.4s' }} />
              </div>
            ) : (
              <>
                <p className="followup-answer whitespace-pre-line">{fu.answer}</p>
                {fu.sources && fu.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: 'none' }}>
                    {fu.sources.map(s => (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded transition-colors"
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

      {hasResult && (
        <div
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-lg px-4 py-3"
          style={{ background: cardBg, boxShadow: neuExtruded, border: 'none' }}
          ref={followUpEndRef}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MessageSquarePlus size={14} style={{ color: textSubtle, flexShrink: 0 }} />
            <input
              type="text"
              value={followUpInput}
              onChange={e => onFollowUpInputChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onFollowUp(followUpInput)}
              placeholder="Ask a follow-up…"
              className="flex-1 text-[13px] bg-transparent outline-none min-w-0"
              style={{ color: textMain }}
              disabled={isFollowingUp || isLoading}
            />
          </div>
          <button
            type="button"
            onClick={() => onFollowUp(followUpInput)}
            disabled={!followUpInput.trim() || isFollowingUp || isLoading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all disabled:opacity-40 shrink-0"
            style={{ background: '#00C4FF', color: '#fff' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#0060df'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#00C4FF'; }}
          >
            {isFollowingUp
              ? <><RefreshCw size={11} className="animate-spin" /> thinking…</>
              : <><Send size={11} /> Follow up</>}
          </button>
        </div>
      )}

      {showComposer && (
        <div className="shrink-0 z-20 px-4 md:px-8 pb-6 pt-2 pointer-events-none">
          <div className="pointer-events-auto max-w-[920px] mx-auto w-full">
            {attachedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 px-1">
                {attachedImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img.dataUrl}
                      alt={img.name}
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
              className="query-bar-glow query-bar-float relative flex items-end w-full"
              style={{ background: headerBg }}
            >
              <Search size={15} className="absolute left-4 top-4 pointer-events-none" style={{ color: textSubtle }} />
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={e => { onInputChange(e.target.value); onTextareaInput(); }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSend(inputValue);
                  }
                }}
                placeholder="Ask a growth intelligence question…"
                className="query-textarea w-full pl-11 pr-[96px] py-3.5 bg-transparent outline-none font-sans"
                style={{ color: textMain }}
                disabled={isLoading}
                rows={1}
              />
              <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onAttachClick}
                  className="neu-extruded-sm w-9 h-9 flex items-center justify-center rounded-xl"
                  style={{ color: textSubtle }}
                  aria-label="Attach image"
                >
                  <Paperclip size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onSend(inputValue)}
                  disabled={(!inputValue.trim() && attachedImages.length === 0) || isLoading}
                  className="bg-gradient-signature flex items-center justify-center w-9 h-9 rounded-lg text-[13px] font-medium disabled:opacity-35"
                >
                  {isLoading
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
