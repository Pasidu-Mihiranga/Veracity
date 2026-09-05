'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Plus, History, Trash2, PanelLeft, PanelLeftClose, Folder, FolderOpen, FolderPlus, ChevronDown, ChevronRight, MessageSquare, Pencil,
} from 'lucide-react';
import type { ChatSession } from '@/lib/conversations';
import {
  createMarketProject,
  deleteMarketProject,
  listMarketProjects,
  updateMarketProject,
  type MarketProject,
} from '@/lib/projects';
import { BrandWordmark } from '@/components/ui/BrandWordmark';
import { SidebarAgentRow } from '@/components/ui/SidebarAgentRow';
import { WatchlistsPanel } from '@/components/ui/WatchlistsPanel';
import { ALL_DOMAINS, type Domain } from '@/lib/domain-meta';
import type { AgentRun } from '@/lib/agents/types';
import { featureFlags } from '@/lib/feature-flags';

export type SessionSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNewQuery: (project?: MarketProject) => void;
  selectedProject?: MarketProject | null;
  onSelectProject?: (project: MarketProject | null) => void;
  /** Bump to force a re-read of the project list. */
  projectsRefreshKey?: number;
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
  selectedProject,
  onSelectProject,
  projectsRefreshKey,
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
  const [projects, setProjects] = useState<MarketProject[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ Recent: true });
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: '', product: '', productUrl: '', competitors: '', geography: '', decisionContext: '', approvedSources: '', blockedSources: '',
  });
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectError, setProjectError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'project' | 'session';
    idOrName: string;
    displayTitle: string;
  } | null>(null);

  // Re-reads when `projectsRefreshKey` changes. A project created from the
  // empty state lives outside this component, so without the key the sidebar
  // would keep showing an empty list until a full reload.
  useEffect(() => {
    listMarketProjects().then(setProjects).catch(() => setProjects([]));
  }, [projectsRefreshKey]);

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderName]: prev[folderName] === false,
    }));
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'project') {
      const projectId = deleteConfirm.idOrName;
      setProjects((prev) => prev.filter((project) => project.id !== projectId));
      if (selectedProject?.id === projectId && onSelectProject) {
        onSelectProject(null);
      }
      await deleteMarketProject(projectId);
    } else {
      await onDeleteSession(deleteConfirm.idOrName);
    }
    setDeleteConfirm(null);
  };

  const handleCreateProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newProject.name.trim();
    const product = newProject.product.trim();
    if (!name || !product) return;
    setProjectError('');
    try {
      const input = {
        name,
        product,
        productUrl: newProject.productUrl.trim(),
        competitors: newProject.competitors.split(',').map((value) => value.trim()).filter(Boolean),
        geography: newProject.geography.trim(),
        decisionContext: newProject.decisionContext.trim(),
        approvedSources: newProject.approvedSources.split(',').map((value) => value.trim()).filter(Boolean),
        blockedSources: newProject.blockedSources.split(',').map((value) => value.trim()).filter(Boolean),
      };
      const created = editingProjectId
        ? await updateMarketProject(editingProjectId, input)
        : await createMarketProject(input);
      setProjects((prev) => [created, ...prev.filter((project) => project.id !== created.id)]);
      setExpandedFolders((prev) => ({ ...prev, [created.id]: true }));
      if (editingProjectId) onSelectProject?.(created);
      else onNewQuery(created);
      setNewProject({ name: '', product: '', productUrl: '', competitors: '', geography: '', decisionContext: '', approvedSources: '', blockedSources: '' });
      setEditingProjectId(null);
      setShowFolderModal(false);
    } catch {
      setProjectError('Could not save this project. Apply the market-project migration and try again.');
    }
  };

  const openCreateProject = () => {
    setEditingProjectId(null);
    setProjectError('');
    setNewProject({ name: '', product: '', productUrl: '', competitors: '', geography: '', decisionContext: '', approvedSources: '', blockedSources: '' });
    setShowFolderModal(true);
  };

  const openEditProject = (project: MarketProject) => {
    setEditingProjectId(project.id);
    setProjectError('');
    setNewProject({
      name: project.name,
      product: project.product,
      productUrl: project.product_url ?? '',
      competitors: project.competitors.join(', '),
      geography: project.geography ?? '',
      decisionContext: project.decision_context ?? '',
      approvedSources: project.approved_sources.join(', '),
      blockedSources: project.blocked_sources.join(', '),
    });
    setShowFolderModal(true);
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
        role="navigation"
        aria-label="Main Navigation"
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
        className="sidebar-collapse-btn hidden md:flex"
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
        {/*
          The logo is the universal "take me home" affordance and people click it
          expecting that. It was a plain div — no handler, no role, no keyboard
          access — so it did nothing at all.

          Home means a clean slate: clear the conversation *and* deselect the
          project, so the user lands on the start screen rather than staring at
          the previous project's panels wondering why nothing reset.
        */}
        <div className="pt-3" />

        <div className="px-3 pt-3 pb-2">
          <button
            type="button"
            onClick={() => onNewQuery(undefined)}
            className="bg-gradient-signature w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[13px] font-semibold font-sans focus-ring min-h-11 cursor-pointer rounded-xl"
          >
            <Plus size={14} /> New research
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-3">
          <div className="neu-extruded flex-1 flex flex-col overflow-hidden rounded-[20px]" style={{ background: cardBg2 }}>
            <div className="px-3 py-2 flex items-center justify-between border-b border-border/40 shrink-0">
              <div className="flex items-center gap-1.5">
                <Folder size={12} style={{ color: textSubtle }} />
                <span className="ui-section-label" style={{ color: textSubtle }}>
                  Market Projects
                </span>
              </div>
              <button
                type="button"
                onClick={openCreateProject}
                className="icon-btn hover:text-accent" aria-label="New folder"
                title="Create Market Project"
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
                  {projects.map((project) => {
                    const isOpen = expandedFolders[project.id] !== false;
                    const folderSessions = sessions.filter(
                      (session) => session.project_id === project.id,
                    );

                    return (
                      <div key={project.id} className="flex flex-col gap-0.5">
                        <div
                          onClick={() => {
                            toggleFolder(project.id);
                            onSelectProject?.(project);
                          }}
                          className={`flex items-center justify-between px-2 py-1.5 rounded-xl cursor-pointer select-none transition-all group relative border ${
                            selectedProject?.id === project.id
                              ? 'bg-accent/20 border-accent/40 shadow-xs ring-1 ring-accent/30 text-accent'
                              : 'border-transparent hover:bg-accent/10'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                            {isOpen ? (
                              <ChevronDown size={13} className={selectedProject?.id === project.id ? 'text-accent' : 'text-muted-foreground shrink-0'} />
                            ) : (
                              <ChevronRight size={13} className={selectedProject?.id === project.id ? 'text-accent' : 'text-muted-foreground shrink-0'} />
                            )}
                            {isOpen ? (
                              <FolderOpen size={14} className="text-accent shrink-0" />
                            ) : (
                              <Folder size={14} className="text-accent/80 shrink-0" />
                            )}
                            <span className={`min-w-0 truncate text-xs ${selectedProject?.id === project.id ? 'font-bold text-accent' : 'font-semibold text-foreground'}`} title={`${project.product}${project.geography ? ` · ${project.geography}` : ''}`}>
                              {project.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditProject(project);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-md transition-all cursor-pointer"
                              title={`Edit project ${project.name}`}
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({
                                  type: 'project',
                                  idOrName: project.id,
                                  displayTitle: `project "${project.name}"`,
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-600 hover:bg-red-500/15 rounded-md transition-all cursor-pointer"
                              title={`Delete project ${project.name}`}
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
                                No research conversations yet
                              </span>
                            ) : (
                              folderSessions.map((session) => (
                                <div
                                  key={session.id}
                                  onClick={() => {
                                    onSelectProject?.(project);
                                    onLoadSession(session.id);
                                  }}
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
                              onClick={() => {
                                onSelectProject?.(projects.find((project) => project.id === session.project_id) ?? null);
                                onLoadSession(session.id);
                              }}
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
                <h3 className="text-sm font-bold text-foreground">{editingProjectId ? 'Edit Market Project' : 'Create Market Project'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFolderModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground p-1 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Project name
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Acme 2026 market watch"
                  value={newProject.name}
                  onChange={(e) => setNewProject((value) => ({ ...value, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Product or company</label>
                <input
                  type="text"
                  placeholder="e.g. Acme Analytics"
                  value={newProject.product}
                  onChange={(e) => setNewProject((value) => ({ ...value, product: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Product URL</label>
                  <input
                    type="url"
                    placeholder="https://…"
                    value={newProject.productUrl}
                    onChange={(e) => setNewProject((value) => ({ ...value, productUrl: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Geography</label>
                  <input
                    type="text"
                    placeholder="e.g. Sri Lanka"
                    value={newProject.geography}
                    onChange={(e) => setNewProject((value) => ({ ...value, geography: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Competitors</label>
                <input
                  type="text"
                  placeholder="Comma separated: Rival A, Rival B"
                  value={newProject.competitors}
                  onChange={(e) => setNewProject((value) => ({ ...value, competitors: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Decision to support</label>
                <textarea
                  rows={3}
                  placeholder="What decision should this research help you make?"
                  value={newProject.decisionContext}
                  onChange={(e) => setNewProject((value) => ({ ...value, decisionContext: e.target.value }))}
                  className="w-full resize-none px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Preferred domains</label>
                  <input
                    type="text"
                    placeholder="official.com, regulator.gov"
                    value={newProject.approvedSources}
                    onChange={(e) => setNewProject((value) => ({ ...value, approvedSources: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Avoid domains</label>
                  <input
                    type="text"
                    placeholder="Research preference, not a security block"
                    value={newProject.blockedSources}
                    onChange={(e) => setNewProject((value) => ({ ...value, blockedSources: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-accent/5 border border-border text-sm text-foreground focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {projectError ? <p className="text-xs text-red-500">{projectError}</p> : null}

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
                  disabled={!newProject.name.trim() || !newProject.product.trim()}
                  className="px-4.5 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {editingProjectId ? 'Save Project' : 'Create Project'}
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
                  Are you sure you want to delete {deleteConfirm.displayTitle}?
                  {deleteConfirm.type === 'project'
                    ? ' Its conversations will remain available under All Recent Research.'
                    : ' This conversation will be permanently removed.'}
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
