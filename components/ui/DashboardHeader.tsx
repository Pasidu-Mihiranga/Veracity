'use client';

import type { RefObject } from 'react';
import {
  BarChart3, Brain, Crosshair, LogOut, Sparkles, Sun, Moon, User,
} from 'lucide-react';
import type { Domain } from '@/lib/domain-meta';

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
  onOpenMemory: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  userEmail: string | null;
  showUserMenu: boolean;
  onToggleUserMenu: () => void;
  onSignOut: () => void;
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
  selectedAgents: _selectedAgents,
  mirofishRunning: _mirofishRunning,
  onOpenMemory,
  isDark,
  onToggleTheme,
  userEmail,
  showUserMenu,
  onToggleUserMenu,
  onSignOut,
  textMuted,
  textSubtle,
  accentInk,
}: DashboardHeaderProps) {
  return (
    <div
      className={`shrink-0 z-30 px-3 md:px-5 pt-3 pb-1 ${sidebarCollapsed ? 'pl-12 md:pl-14' : ''}`}
    >
      <header
        ref={headerIslandRef}
        className={`header-island ${headerCompact ? 'header-island--compact' : ''} ${sidebarCollapsed ? 'header-island--rail' : ''}`}
        style={{ background: headerBg }}
      >
        {sidebarCollapsed && (
          <div className="header-island-brand flex items-center shrink-0 pl-1 pr-3">
            <img
              src="/logo.avif"
              alt="Veracity"
              width={140}
              height={36}
              className="brand-logo h-8 w-auto object-left object-contain"
              draggable={false}
            />
          </div>
        )}

        <div className="header-island-tabs flex items-center gap-1.5 shrink-0">
          {([
            { id: 'intelligence' as const, label: 'Intelligence', icon: <Sparkles size={12} /> },
            { id: 'usage' as const, label: 'API usage', icon: <BarChart3 size={12} /> },
            { id: 'steal' as const, label: 'Steal strategy', icon: <Crosshair size={12} /> },
          ]).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTopTabChange(tab.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all min-h-9"
              style={{
                color: topTab === tab.id ? accentInk : textMuted,
                background: 'var(--background)',
                border: 'none',
                boxShadow: topTab === tab.id ? 'var(--shadow-inset-sm)' : 'var(--shadow-extruded-sm)',
              }}
            >
              {tab.icon}
              <span className="header-island-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="header-island-row flex items-center gap-2 sm:gap-3 ml-auto min-w-0">
          <div className="flex items-center gap-2 shrink-0">
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
