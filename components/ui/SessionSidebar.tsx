'use client';

import {
  Plus, RefreshCw, Layers, History, Trash2, PanelLeft, PanelLeftClose, CheckCheck,
} from 'lucide-react';
import type { AgentRun } from '@/lib/agents/types';
import type { ChatSession } from '@/lib/conversations';
import { ALL_DOMAINS, type Domain } from '@/lib/domain-meta';
import { SidebarAgentRow } from '@/components/ui/SidebarAgentRow';

export type SessionSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewQuery: () => void;
  selectedAgents: Record<Domain, boolean>;
  onToggleAgent: (domain: Domain) => void;
  onToggleSelectAll: () => void;
  allSelected: boolean;
  selectedCount: number;
  getRunForDomain: (domain: Domain) => AgentRun | undefined;
  isLoading: boolean;
  hasResult: boolean;
  completedCount: number;
  totalCount: number;
  sessions: ChatSession[];
  loadingSessions: boolean;
  currentSessionId: string | null;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  sidebarBg: string;
  cardBg2: string;
  neuExtrudedSm: string;
  textMain: string;
  textMuted: string;
  textSubtle: string;
  accentInk: string;
};

export function SessionSidebar({
  collapsed,
  onToggleCollapsed,
  onNewQuery,
  selectedAgents,
  onToggleAgent,
  onToggleSelectAll,
  allSelected,
  selectedCount,
  getRunForDomain,
  isLoading,
  hasResult,
  completedCount,
  totalCount,
  sessions,
  loadingSessions,
  currentSessionId,
  onLoadSession,
  onDeleteSession,
  sidebarBg,
  cardBg2,
  neuExtrudedSm,
  textMain,
  textMuted,
  textSubtle,
  accentInk,
}: SessionSidebarProps) {
  return (
    <aside
      className="sidebar-transition flex-shrink-0 flex flex-col h-full relative"
      style={{
        width: collapsed ? '0px' : '280px',
        minWidth: collapsed ? '0px' : '280px',
        background: sidebarBg,
        borderRight: 'none',
        boxShadow: collapsed ? 'none' : neuExtrudedSm,
        overflow: 'visible',
      }}
    >
      <button
        onClick={onToggleCollapsed}
        className="sidebar-collapse-btn"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        style={{ right: collapsed ? '-36px' : '-14px' }}
      >
        {collapsed ? (
          <PanelLeft size={14} style={{ color: textMuted }} />
        ) : (
          <PanelLeftClose size={14} style={{ color: textMuted }} />
        )}
      </button>

      <div
        className="flex flex-col h-full"
        style={{
          width: '280px',
          opacity: collapsed ? 0 : 1,
          transition: 'opacity 0.2s ease',
          overflow: 'hidden',
        }}
      >
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/robot.avif"
              alt=""
              width={40}
              height={46}
              className="brand-mascot w-10 h-10 shrink-0"
              draggable={false}
            />
            <div className="min-w-0">
              <img
                src="/logo-text.avif"
                alt="Veracity"
                width={140}
                height={40}
                className="brand-logo h-6 w-auto max-w-[140px] object-left"
                draggable={false}
              />
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.12em] leading-none mt-1.5"
                style={{ color: textSubtle }}
              >
                Growth Intelligence
              </p>
            </div>
          </div>
        </div>

        <div className="px-3 pt-3 pb-2">
          <button
            onClick={onNewQuery}
            className="bg-gradient-signature w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[13px] font-semibold focus-ring min-h-11"
          >
            <Plus size={14} /> New query
          </button>
        </div>

        <div className="px-3 pb-2">
          <div className="neu-extruded overflow-hidden rounded-[20px]" style={{ background: cardBg2 }}>
            <div className="px-3 py-2.5 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers size={12} style={{ color: textSubtle }} />
                  <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: textSubtle }}>
                    Agents
                  </span>
                </div>
                {isLoading && totalCount > 0 && (
                  <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: textMuted }}>
                    <RefreshCw size={9} className="animate-spin" /> {completedCount}/{totalCount}
                  </span>
                )}
                {hasResult && !isLoading && (
                  <span className="text-[10px] font-semibold" style={{ color: accentInk }}>
                    {completedCount}/{totalCount}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono" style={{ color: textSubtle }}>
                  {selectedCount}/{ALL_DOMAINS.length} selected
                </span>
                <button
                  type="button"
                  onClick={onToggleSelectAll}
                  className={`select-all-btn font-mono flex items-center gap-1 ${allSelected ? 'all-selected' : ''}`}
                >
                  <CheckCheck size={10} />
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>
            <div className="py-1.5 px-1.5 flex flex-col gap-0.5">
              {ALL_DOMAINS.map((d) => (
                <SidebarAgentRow
                  key={d}
                  domain={d}
                  run={getRunForDomain(d)}
                  selected={selectedAgents[d]}
                  onToggle={() => onToggleAgent(d)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-2">
          <div className="neu-extruded overflow-hidden rounded-[20px]" style={{ background: cardBg2 }}>
            <div className="px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <History size={12} style={{ color: textSubtle }} />
                <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: textSubtle }}>
                  Recent
                </span>
              </div>
              {sessions.length > 0 && (
                <span className="text-[10px] font-semibold" style={{ color: textSubtle }}>
                  {sessions.length}
                </span>
              )}
            </div>
            <div className="py-1.5 px-1.5">
              {loadingSessions ? (
                <div className="px-2 py-3 flex flex-col gap-2">
                  <div className="h-3 rounded skeleton w-4/5" />
                  <div className="h-3 rounded skeleton w-3/5" style={{ animationDelay: '0.2s' }} />
                  <div className="h-3 rounded skeleton w-2/3" style={{ animationDelay: '0.4s' }} />
                </div>
              ) : sessions.length > 0 ? (
                <div className="flex flex-col gap-0.5">
                  {sessions.slice(0, 10).map((session) => (
                    <div
                      key={session.id}
                      className={`session-item group relative flex items-center cursor-pointer ${
                        currentSessionId === session.id ? 'active' : ''
                      }`}
                      onClick={() => onLoadSession(session.id)}
                    >
                      <div className="flex-1 min-w-0 pr-6">
                        <p
                          className="text-[12px] font-medium truncate"
                          style={{
                            color: currentSessionId === session.id ? textMain : textMuted,
                          }}
                        >
                          {session.title}
                        </p>
                        {session.created_at && (
                          <p className="text-[9px] font-medium mt-0.5" style={{ color: textSubtle }}>
                            {new Date(session.created_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDeleteSession(session.id);
                        }}
                        className="absolute right-1.5 w-7 h-7 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                        style={{ color: '#0B1A2E' }}
                        title="Delete session"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-4 text-center">
                  <p className="text-[11px]" style={{ color: textSubtle }}>
                    No sessions yet
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 flex items-center gap-2">
          <div className="live-dot" />
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: textSubtle }}>
            live · sourced · grounded
          </span>
        </div>
      </div>
    </aside>
  );
}
