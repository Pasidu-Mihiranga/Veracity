'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus, History, Trash2, PanelLeft, PanelLeftClose, Folder, FolderOpen, FolderPlus, ChevronDown, ChevronRight, MessageSquare,
} from 'lucide-react';
import { listFolders, createFolder, deleteFolder, updateSessionFolder, type ChatSession } from '@/lib/conversations';
import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { SidebarAgentRow } from '@/components/ui/SidebarAgentRow';
import { WatchlistsPanel } from '@/components/ui/WatchlistsPanel';
import { ALL_DOMAINS, type Domain } from '@/lib/domain-meta';
import type { AgentRun } from '@/lib/agents/types';
import { featureFlags } from '@/lib/feature-flags';

export type SessionSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewQuery: (folderName?: string) => void;
  selectedFolder?: string | null;
  onSelectFolder?: (folderName: string | null) => void;
  sessions: ChatSession[];
  loadingSessions: boolean;
  currentSessionId: string | null;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  selectedAgents: Record<Domain, boolean>;
  onToggleAgent: (domain: Domain) => void;
  forceFullSweep?: boolean;
  onToggleForceFullSweep?: () => void;
  getRunForDomain: (domain: Domain) => AgentRun | undefined;
  sidebarBg: string;
  cardBg2: string;
  neuExtrudedSm: string;
  textMain: string;
  textMuted: string;
  textSubtle: string;
};

export function SessionSidebar({
  collapsed,
  onToggleCollapsed,
  onNewQuery,
  selectedFolder,
  onSelectFolder,
  sessions,
  loadingSessions,
  currentSessionId,
  onLoadSession,
  onDeleteSession,
  selectedAgents,
  onToggleAgent,
  forceFullSweep = false,
  onToggleForceFullSweep,
  getRunForDomain,
  sidebarBg,
  cardBg2,
  neuExtrudedSm,
  textMain,
  textMuted,
  textSubtle,
}: SessionSidebarProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [folders, setFolders] = useState<string[]>(['Competitive Strategy', 'Pricing Review', 'GTM Outbound']);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'Competitive Strategy': true,
    'Pricing Review': true,
    'GTM Outbound': true,
    Recent: true,
  });
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'folder' | 'session';
    idOrName: string;
    displayTitle: string;
  } | null>(null);

  useEffect(() => {
    listFolders().then((remoteFolders) => {
      if (remoteFolders.length > 0) {
        setFolders((prev) => [...new Set([...prev, ...remoteFolders])]);
      }
    });
  }, []);

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderName]: prev[folderName] === false,
    }));
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'folder') {
      const folderName = deleteConfirm.idOrName;
      setFolders((prev) => prev.filter((f) => f !== folderName));
      if (selectedFolder === folderName && onSelectFolder) {
        onSelectFolder(null);
      }
      await deleteFolder(folderName);
    } else {
      await onDeleteSession(deleteConfirm.idOrName);
    }
    setDeleteConfirm(null);
  };

  const handleCreateFolder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newFolderName.trim();
    if (trimmed) {
      if (!folders.includes(trimmed)) {
        setFolders((prev) => [...prev, trimmed]);
        setExpandedFolders((prev) => ({ ...prev, [trimmed]: true }));
      }
      await createFolder(trimmed);
    }
    setNewFolderName('');
    setShowFolderModal(false);
  };

  return (
    <>
      {!collapsed && (
        <div
          onClick={onToggleCollapsed}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden animate-fadeIn"
        />
      )}
      <aside
        className={`sidebar-transition flex-shrink-0 flex flex-col h-full relative z-40 md:z-auto ${
          !collapsed ? 'fixed inset-y-0 left-0 md:relative' : ''
        }`}
        style={{
          width: collapsed ? '0px' : '305px',
          minWidth: collapsed ? '0px' : '305px',
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
          width: '305px',
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
              <BrandWordmark size="sm" />
              <p className="ui-section-label mt-1.5" style={{ color: textSubtle }}>
                Growth Intelligence
              </p>
            </div>
          </div>
        </div>

        <div className="px-3 pt-3 pb-2">
          <button
            onClick={() => onNewQuery()}
            className="bg-gradient-signature w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[13px] font-semibold font-sans focus-ring min-h-11"
          >
            <Plus size={14} /> New query
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-3">
          <div className="neu-extruded flex-1 flex flex-col overflow-hidden rounded-[20px]" style={{ background: cardBg2 }}>
            <div className="px-3 py-2 flex items-center justify-between border-b border-border/40 shrink-0">
              <div className="flex items-center gap-1.5">
                <Folder size={12} style={{ color: textSubtle }} />
                <span className="ui-section-label" style={{ color: textSubtle }}>
                  Project Folders
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowFolderModal(true)}
                className="hover:text-accent p-1 text-muted-foreground transition-colors"
                title="Create Project Folder"
              >
                <FolderPlus size={13} />
              </button>
            </div>

            {/* Tree Folder Directory Container */}
            <div className="py-2 px-2 overflow-y-auto flex-1 flex flex-col gap-1.5">
              {loadingSessions ? (
                <div className="px-2 py-3 flex flex-col gap-2">
                  <div className="h-3 rounded skeleton w-4/5" />
                  <div className="h-3 rounded skeleton w-3/5" style={{ animationDelay: '0.2s' }} />
                  <div className="h-3 rounded skeleton w-2/3" style={{ animationDelay: '0.4s' }} />
                </div>
              ) : (
                <>
                  {/* Custom Project Folders */}
                  {folders.map((folderName) => {
                    const isOpen = expandedFolders[folderName] !== false;
                    const folderSessions = sessions.filter(
                      (s) =>
                        s.folder_name?.toLowerCase() === folderName.toLowerCase() ||
                        (!s.folder_name &&
                          (s.title.toLowerCase().includes(folderName.toLowerCase()) ||
                            s.id.toLowerCase().includes(folderName.toLowerCase()))),
                    );

                    return (
                      <div key={folderName} className="flex flex-col gap-0.5">
                        <div
                          onClick={() => {
                            toggleFolder(folderName);
                            if (onSelectFolder) onSelectFolder(folderName);
                          }}
                          className={`flex items-center justify-between px-2 py-1.5 rounded-xl cursor-pointer select-none transition-all group relative border ${
                            selectedFolder?.toLowerCase() === folderName.toLowerCase()
                              ? 'bg-accent/20 border-accent/40 shadow-xs ring-1 ring-accent/30 text-accent'
                              : 'border-transparent hover:bg-accent/10'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                            {isOpen ? (
                              <ChevronDown size={13} className={selectedFolder?.toLowerCase() === folderName.toLowerCase() ? 'text-accent' : 'text-muted-foreground shrink-0'} />
                            ) : (
                              <ChevronRight size={13} className={selectedFolder?.toLowerCase() === folderName.toLowerCase() ? 'text-accent' : 'text-muted-foreground shrink-0'} />
                            )}
                            {isOpen ? (
                              <FolderOpen size={14} className="text-accent shrink-0" />
                            ) : (
                              <Folder size={14} className="text-accent/80 shrink-0" />
                            )}
                            <span className={`text-xs truncate ${selectedFolder?.toLowerCase() === folderName.toLowerCase() ? 'font-bold text-accent' : 'font-semibold text-foreground'}`}>
                              {folderName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({
                                  type: 'folder',
                                  idOrName: folderName,
                                  displayTitle: `folder "${folderName}"`,
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-600 hover:bg-red-500/15 rounded-md transition-all cursor-pointer"
                              title={`Delete folder ${folderName}`}
                            >
                              <Trash2 size={12} className="text-red-500" />
                            </button>
                            <span className="px-1.5 py-0.2 rounded-full bg-accent/10 text-[10px] font-mono text-muted-foreground">
                              {folderSessions.length}
                            </span>
                          </div>
                        </div>

                        {isOpen && (
                          <div className="ml-3 pl-2.5 border-l border-border/40 flex flex-col gap-0.5 my-0.5">
                            {folderSessions.length === 0 ? (
                              <span className="text-[11px] text-muted-foreground italic px-2 py-1 block">
                                No chats in folder
                              </span>
                            ) : (
                              folderSessions.map((session) => (
                                <div
                                  key={session.id}
                                  onClick={() => onLoadSession(session.id)}
                                  className={`group relative flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-all ${
                                    currentSessionId === session.id
                                      ? 'bg-accent/20 text-accent font-semibold'
                                      : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-6">
                                    <MessageSquare size={12} className="shrink-0 opacity-70" />
                                    <span className="truncate">{session.title}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirm({
                                        type: 'session',
                                        idOrName: session.id,
                                        displayTitle: `chat "${session.title}"`,
                                      });
                                    }}
                                    className="absolute right-1 opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-600 hover:bg-red-500/15 rounded-md transition-all cursor-pointer"
                                    title="Delete chat"
                                  >
                                    <Trash2 size={11} className="text-red-500" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* All Recent Chats Section */}
                  <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-border/30">
                    <div
                      onClick={() => toggleFolder('Recent')}
                      className="flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-accent/10 cursor-pointer select-none transition-colors"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {expandedFolders['Recent'] !== false ? (
                          <ChevronDown size={13} className="text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight size={13} className="text-muted-foreground shrink-0" />
                        )}
                        <History size={13} className="text-accent shrink-0" />
                        <span className="text-xs font-semibold text-foreground truncate">All Recent Research</span>
                      </div>
                      <span className="px-1.5 py-0.2 rounded-full bg-accent/10 text-[10px] font-mono text-muted-foreground">
                        {sessions.length}
                      </span>
                    </div>

                    {expandedFolders['Recent'] !== false && (
                      <div className="ml-3 pl-2.5 border-l border-border/40 flex flex-col gap-0.5 my-0.5">
                        {sessions.length === 0 ? (
                          <span className="text-[11px] text-muted-foreground italic px-2 py-1 block">
                            No research sessions yet
                          </span>
                        ) : (
                          sessions.map((session) => (
                            <div
                              key={session.id}
                              onClick={() => onLoadSession(session.id)}
                              className={`group relative flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-all ${
                                currentSessionId === session.id
                                  ? 'bg-accent/20 text-accent font-semibold'
                                  : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-6">
                                <MessageSquare size={12} className="shrink-0 opacity-70" />
                                <span className="truncate">{session.title}</span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm({
                                    type: 'session',
                                    idOrName: session.id,
                                    displayTitle: `chat "${session.title}"`,
                                  });
                                }}
                                className="absolute right-1 opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-600 hover:bg-red-500/15 rounded-md transition-all cursor-pointer"
                                title="Delete chat"
                              >
                                <Trash2 size={11} className="text-red-500" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 flex items-center gap-2">
          <div className="live-dot" />
          <span className="ui-mono uppercase tracking-wide" style={{ color: textSubtle, fontSize: 10 }}>
            live · sourced · grounded
          </span>
        </div>
      </div>
    </aside>

      {showFolderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-sm rounded-2xl p-5 bg-card border border-border flex flex-col gap-4 shadow-2xl animate-scaleUp"
            style={{ boxShadow: 'var(--shadow-extruded)' }}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <FolderPlus size={16} className="text-accent" />
                <h3 className="text-sm font-bold text-foreground">Create Project Folder</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground p-1 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFolder} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. 2026 Competitive Strategy"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFolderModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-4.5 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-sm rounded-2xl p-5 bg-card border border-red-500/30 flex flex-col gap-4 shadow-2xl animate-scaleUp"
            style={{ boxShadow: 'var(--shadow-extruded)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Confirm Deletion</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Are you sure you want to delete {deleteConfirm.displayTitle}? This action will permanently remove it from your database.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-accent/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeDelete()}
                className="px-4.5 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white shadow-xs transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
