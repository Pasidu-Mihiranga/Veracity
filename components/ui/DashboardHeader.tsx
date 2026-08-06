'use client';

import type { RefObject } from 'react';
import {
  BarChart3, Bell, Bot, Brain, Building2, Crosshair, Eye, Home, LogOut, Network, Sparkles, Sun, Moon, User,
} from 'lucide-react';
import type { Domain } from '@/lib/domain-meta';
import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { featureFlags } from '@/lib/feature-flags';
import { WorkspaceSwitcher } from '@/components/ui/WorkspaceSwitcher';

export type TopTab = 'home' | 'intelligence' | 'watchlists' | 'usage' | 'steal' | 'profile';

export type DashboardHeaderProps = {
  headerIslandRef: RefObject<HTMLElement | null>;
  headerCompact: boolean;
  sidebarCollapsed: boolean;
  onOpenSidebar?: () => void;
  headerBg: string;
  topTab: TopTab;
  onTopTabChange: (tab: TopTab) => void;
  selectedAgents: Record<Domain, boolean>;
  mirofishRunning: boolean;
  onOpenAgents?: () => void;
  onOpenMemory: () => void;
  onOpenProfile?: () => void;
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
  onOpenSidebar,
  headerBg,
  topTab,
  onTopTabChange,
  selectedAgents,
  mirofishRunning,
  onOpenAgents,
  onOpenMemory,
  onOpenProfile,
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
  const isIntelligence = topTab === 'intelligence';
  return (
    <div
      /*
        Same gutters on every tab. Research used to add 56px of left padding
        when the sidebar was collapsed, which narrowed the island by that much —
        so the bar was visibly shorter there than on Home, which is the size
        difference people notice.
      */
      className="shrink-0 z-30 px-2 md:px-5"
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
        className={`header-island ${headerCompact ? 'header-island--compact' : ''}`}
        style={{ background: headerBg }}
      >
        {/* Mobile Hamburger Menu Button (only when sidebar is active) */}
        {isIntelligence && onOpenSidebar && (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/10 mr-1"
            title="Open Sidebar"
          >
            ☰
          </button>
        )}

        <div className="header-island-brand flex items-center shrink-0 pl-1 pr-3 gap-2.5">
          <img
            src="/robot.avif"
            alt="Veracity Robot"
            width={42}
            height={46}
            className="brand-mascot h-10 w-auto shrink-0 transition-transform hover:scale-105"
            draggable={false}
          />
          <BrandWordmark size="md" />
        </div>

        <div className="header-island-tabs flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar" role="tablist">
          {([
            { id: 'home' as const, label: 'Home' },
            { id: 'intelligence' as const, label: 'Research' },
            ...(featureFlags.watchlists ? [{ id: 'watchlists' as const, label: 'Watchlists' }] : []),
            { id: 'steal' as const, label: 'Steal strategy' },
            { id: 'profile' as const, label: 'Profile & Settings' },
          ]).map(tab => {
            const active = topTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onTopTabChange(tab.id)}
                className="header-nav-tab flex items-center justify-center px-3.5 py-1.5 text-[13.5px] sm:text-[14px] font-medium transition-all min-h-9 rounded-xl cursor-pointer"
                data-active={active ? 'true' : 'false'}
              >
                <span className="header-island-tab-label">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="header-island-row flex items-center gap-2 sm:gap-3 ml-auto min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            {mirofishRunning ? (
              <span className="neu-pill-accent ui-mono px-2 py-1" style={{ color: accentInk, fontSize: 10 }}>
                scenario running
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
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={onToggleUserMenu}
                className="header-avatar w-9 h-9 flex items-center justify-center text-[12px] font-bold shrink-0 text-white cursor-pointer hover:opacity-90 transition-opacity"
                title={userEmail || 'Account'}
              >
                {userEmail ? userEmail[0].toUpperCase() : <User size={13} />}
              </button>
              {showUserMenu && (
                <div
                  className="absolute right-0 top-full mt-2.5 w-64 p-2 z-50 rounded-2xl border border-border shadow-2xl animate-fadeIn"
                  style={{ backgroundColor: 'var(--card)' }}
                >
                  {userEmail && (
                    <div className="px-3 py-2 border-b border-border/40 mb-1">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Signed in as</p>
                      <p className="text-[12px] font-semibold truncate text-foreground mt-0.5" title={userEmail}>{userEmail}</p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      onToggleUserMenu();
                      onTopTabChange('profile');
                      if (onOpenProfile) onOpenProfile();
                    }}
                    className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-left transition-colors hover:bg-accent/10 hover:text-accent cursor-pointer"
                    style={{ color: textMuted }}
                  >
                    <User size={15} className="shrink-0" style={{ color: textSubtle }} />
                    <span>Profile & Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSignOut}
                    className="w-full flex items-center justify-start gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-left transition-colors hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                    style={{ color: textMuted }}
                  >
                    <LogOut size={15} className="shrink-0" style={{ color: textSubtle }} />
                    <span>Sign out</span>
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
