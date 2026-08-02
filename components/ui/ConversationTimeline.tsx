'use client';

import { ArrowUpRight, Bot, LoaderCircle, UserRound } from 'lucide-react';
import Image from 'next/image';
import type { ChatMessage } from '@/types/chat-ui';

type Props = {
  messages: ChatMessage[];
  currentResultId?: number;
  textMain: string;
  textMuted: string;
  textSubtle: string;
  cardBg: string;
  cardBg2: string;
  accentInk: string;
  neuExtrudedSm: string;
};

export function ConversationTimeline({
  messages,
  currentResultId,
  textMain,
  textMuted,
  textSubtle,
  cardBg,
  cardBg2,
  accentInk,
  neuExtrudedSm,
}: Props) {
  if (messages.length === 0) return null;

  return (
    <section aria-label="Research conversation" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <p className="label-mono">Research conversation</p>
          <p className="text-[12px] mt-1" style={{ color: textMuted }}>
            Questions, answers, citations, and research runs stay in this project.
          </p>
        </div>
        <span
          className="text-[10px] font-mono px-2 py-1 rounded-full"
          style={{ background: cardBg2, color: textSubtle }}
        >
          {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
      </div>

      {messages.map((message) => {
        const isUser = message.role === 'user';
        const isCurrentStructuredResult =
          message.id === currentResultId && Boolean(message.orchestratorOutput);
        const isPending = !isUser && !message.content && !message.streamError;

        return (
          <article
            key={`${message.role}-${message.id}`}
            className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            {!isUser && (
              <span
                className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{ background: cardBg2, color: accentInk, boxShadow: neuExtrudedSm }}
              >
                <Bot size={13} />
              </span>
            )}

            <div
              className={`max-w-[min(860px,88%)] rounded-2xl px-4 py-3 ${isUser ? 'rounded-br-md' : 'rounded-bl-md'}`}
              style={{
                background: isUser ? accentInk : cardBg,
                color: isUser ? 'white' : textMain,
                boxShadow: isUser ? 'none' : neuExtrudedSm,
              }}
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                {isUser && <UserRound size={11} />}
                <span
                  className="text-[9px] font-mono uppercase tracking-[0.12em]"
                  style={{ color: isUser ? 'rgba(255,255,255,.72)' : textSubtle }}
                >
                  {isUser ? 'You' : isCurrentStructuredResult ? 'Latest research answer' : 'Veracity'}
                </span>
              </div>

              {isPending ? (
                <div className="flex items-center gap-2 text-[13px]" style={{ color: textMuted }}>
                  <LoaderCircle size={13} className="animate-spin" />
                  Researching and checking sources…
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-[13px] leading-6">{message.content}</p>
              )}

              {message.images && message.images.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.images.map((image, index) => (
                    <Image
                      key={`${image.name}-${index}`}
                      src={image.dataUrl}
                      alt={image.name}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}

              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {message.sources.slice(0, 8).map((source) => (
                    <a
                      key={`${source.url}-${source.title}`}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-mono"
                      style={{ background: cardBg2, color: textMuted }}
                    >
                      {source.title}
                      <ArrowUpRight size={9} />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {isUser && (
              <span
                className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{ background: cardBg2, color: accentInk, boxShadow: neuExtrudedSm }}
              >
                <UserRound size={13} />
              </span>
            )}
          </article>
        );
      })}
    </section>
  );
}
