'use client';

import type { RefObject } from 'react';
import {
  BarChart3, Bell, Bot, Brain, Building2, Crosshair, LogOut, Network, Sparkles, Sun, Moon, User,
} from 'lucide-react';
import type { Domain } from '@/lib/domain-meta';
import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { featureFlags } from '@/lib/feature-flags';
import { WorkspaceSwitcher } from '@/components/ui/WorkspaceSwitcher';

export type TopTab = 'intelligence' | 'usage' | 'steal';

export type DashboardHeaderProps = {
  headerIslandRef: RefObject<HTMLElement | null>;
  headerCompact: boolean;
  sidebarCollapsed: boolean;
  headerBg: string;
  topTab: TopTab;
  onTopTabChange: (tab: TopTab) => void;
  selectedAgents: Record<Domain, boolean>;
  mirofishRunning: boolean;
  onOpenAgents?: () => void;
  onOpenMemory: () => void;
  onOpenAlerts?: () => void;
  alertsUnread?: number;
  onOpenMembers?: () => void;
  onOpenOrgIntel?: () => void;
  onOpenKgExplorer?: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  userEmail: string | null;
  showUserMenu: boolean;
  onToggleUserMenu: () => void;
  onSignOut: () => void;
  viewMode?: import('@/types/chat-ui').ProductViewMode;
  onViewModeChange?: (mode: import('@/types/chat-ui').ProductViewMode) => void;
  textMuted: string;
  textSubtle: string;
  accentInk: string;
};

export function DashboardHeader({
  headerIslandRef,
  headerCompact,
  sidebarCollapsed,
  headerBg,
  topTab,
  onTopTabChange,
  selectedAgents,
  mirofishRunning,
  onOpenAgents,
  onOpenMemory,
  onOpenAlerts,
  alertsUnread = 0,
  onOpenMembers,
  onOpenOrgIntel,
  onOpenKgExplorer,
  isDark,
  onToggleTheme,
  userEmail,
  showUserMenu,
  onToggleUserMenu,
  onSignOut,
  viewMode = 'executive',
  onViewModeChange,
  textMuted,
  textSubtle,
  accentInk,
}: DashboardHeaderProps) {
  const activeAgents = Object.values(selectedAgents).filter(Boolean).length;
  return (
    <div
      className={`shrink-0 z-30 px-3 md:px-5 ${sidebarCollapsed ? 'pl-12 md:pl-14' : ''}`}
      style={{
        height: 60,
        paddingTop: 8,
        paddingBottom: 4,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <header
        ref={headerIslandRef}
        className={`header-island ${headerCompact ? 'header-island--compact' : ''} ${sidebarCollapsed ? 'header-island--rail' : ''}`}
        style={{ background: headerBg }}
      >
        {sidebarCollapsed && (
          <div className="header-island-brand flex items-center shrink-0 pl-1 pr-3">
            <BrandWordmark size="md" />
          </div>
        )}

        <div className="header-island-tabs flex items-center gap-0.5 shrink-0" role="tablist">
          {([
            { id: 'intelligence' as const, label: 'Intelligence', icon: <Sparkles size={13} /> },
            { id: 'usage' as const, label: 'API usage', icon: <BarChart3 size={13} /> },
            { id: 'steal' as const, label: 'Steal strategy', icon: <Crosshair size={13} /> },
          ]).map(tab => {
            const active = topTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTopTabChange(tab.id)}
                className="header-nav-tab flex items-center gap-1.5 px-3 py-2 text-[12.5px] font-medium transition-colors min-h-9"
                data-active={active ? 'true' : 'false'}
              >
                {tab.icon}
                <span className="header-island-tab-label">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="header-island-row flex items-center gap-2 sm:gap-3 ml-auto min-w-0">
          <div className="header-island-stats hidden md:flex items-center gap-2 shrink-0">
            {onOpenAgents ? (
              <button
                type="button"
                onClick={onOpenAgents}
                className="neu-pill ui-mono px-2.5 py-1 flex items-center gap-1.5 hover:opacity-80 transition-all cursor-pointer"
                style={{ color: accentInk, fontSize: 10 }}
                title="Configure Swarm Agents"
              >
                <Bot size={12} />
                <span>{activeAgents} agents</span>
              </button>
            ) : (
              <span className="neu-pill ui-mono px-2 py-1" style={{ color: accentInk, fontSize: 10 }}>
                {activeAgents} agents
              </span>
            )}
            {mirofishRunning ? (
              <span className="neu-pill-accent ui-mono px-2 py-1" style={{ color: accentInk, fontSize: 10 }}>
                forecast live
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {featureFlags.workspaces ? (
              <WorkspaceSwitcher
                onOpenMembers={onOpenMembers}
                accentInk={accentInk}
                textMuted={textMuted}
              />
            ) : null}
            {featureFlags.orgIntelligence && onOpenOrgIntel ? (
              <button
                type="button"
                onClick={onOpenOrgIntel}
                className="neu-extruded-sm w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ color: textMuted }}
                title="Organization Intelligence"
              >
                <Building2 size={14} />
              </button>
            ) : null}
            {featureFlags.kgExplorer && onOpenKgExplorer ? (
              <button
                type="button"
                onClick={onOpenKgExplorer}
                className="neu-extruded-sm w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ color: textMuted }}
                title="Knowledge Graph"
              >
                <Network size={14} />
              </button>
            ) : null}
            {featureFlags.alerts && onOpenAlerts ? (
              <button
                type="button"
                onClick={onOpenAlerts}
                className="neu-extruded-sm w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative"
                style={{ color: textMuted }}
                title="Alerts"
              >
                <Bell size={14} />
                {alertsUnread > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-accent text-white text-[9px] font-mono flex items-center justify-center">
                    {alertsUnread > 9 ? '9+' : alertsUnread}
                  </span>
                ) : null}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onOpenMemory}
              className="neu-extruded-sm w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ color: textMuted }}
              title="Durable memory"
            >
              <Brain size={14} />
            </button>
            <button
              type="button"
              onClick={onToggleTheme}
              className="neu-extruded-sm w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ color: textMuted }}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={onToggleUserMenu}
                className="header-avatar w-9 h-9 flex items-center justify-center text-[12px] font-bold shrink-0 text-white"
                title={userEmail || 'Account'}
              >
                {userEmail ? userEmail[0].toUpperCase() : <User size={13} />}
              </button>
              {showUserMenu && (
                <div className="veracity-card absolute right-0 top-11 w-52 py-1.5 z-50">
                  {userEmail && (
                    <p className="px-3 py-2 text-[12px] font-medium truncate" style={{ color: textMuted }}>{userEmail}</p>
                  )}
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left transition-colors hover:bg-muted"
                    style={{ color: textMuted }}
                  >
                    <LogOut size={13} style={{ color: textSubtle }} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </div>
  );
}
