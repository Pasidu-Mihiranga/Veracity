 'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { useTheme } from '@/lib/theme-provider';
import type { RecommendationRating } from '@/lib/feedback';
import type { AttachedImage, PipelineStage } from '@/types/chat-ui';
import { ALL_DOMAINS, type Domain } from '@/lib/domain-meta';
import { readFileAsBase64 } from '@/lib/chat-client';
import { useChatStream } from '@/hooks/useChatStream';
import { useDashboardSessions } from '@/hooks/useDashboardSessions';
import { useHeaderCompress } from '@/hooks/useHeaderCompress';
import { useChatOrchestration } from '@/hooks/useChatOrchestration';
import { useRecallQuery } from '@/hooks/useRecallQuery';
import { SessionSidebar } from '@/components/ui/SessionSidebar';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { PanelSkeleton } from '@/components/ui/PanelSkeleton';
import { DashboardWorkspace } from '@/components/dashboard/DashboardWorkspace';
import { AlertsDrawer } from '@/components/ui/AlertsDrawer';
import { AgentsDrawer } from '@/components/ui/AgentsDrawer';
import { WorkspaceMembersDrawer } from '@/components/ui/WorkspaceMembersDrawer';
import { OrgIntelligencePanel } from '@/components/ui/OrgIntelligencePanel';
import { KnowledgeGraphExplorer } from '@/components/ui/KnowledgeGraphExplorer';
import { featureFlags } from '@/lib/feature-flags';
import { buildPipelineStages, getOutputForDomain, getRunForDomain } from '@/lib/agent-progress';
import {
  defaultSelectedAgents,
  loadSelectedAgents,
  saveSelectedAgents,
  loadForceFullSweep,
  saveForceFullSweep,
} from '@/lib/selected-agents-storage';
const MemoryDrawer = dynamic(
  () => import('@/components/ui/MemoryDrawer').then((m) => m.MemoryDrawer),
  { ssr: false },
);

export default function VeracityDashboard() {
  const router = useRouter();
  const supabase = createClient();
  const { streamChat } = useChatStream();
  const { isDark, toggle: toggleTheme, surface, surface2, text, textMuted, textSubtle, accent, border } = useTheme();
  const { mainScrollRef, headerIslandRef, headerCompact, onMainScroll, resetHeaderCompress } = useHeaderCompress();
  const {
    sessions, loadingSessions, currentSessionId, setCurrentSessionId, messages, setMessages,
    followUps, setFollowUps, refreshSessions, loadSession, deleteSession, resetConversation, queryCacheStats,
  } = useDashboardSessions();
  const memoryQuery = useRecallQuery();

  const [inputValue, setInputValue] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<Domain | null>(null);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [ratedRecs, setRatedRecs] = useState<Record<string, RecommendationRating>>({});
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState(false);
  const [agentsDrawerOpen, setAgentsDrawerOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alertsUnread, setAlertsUnread] = useState(0);
  const [membersOpen, setMembersOpen] = useState(false);
  const [orgIntelOpen, setOrgIntelOpen] = useState(false);
  const [kgExplorerOpen, setKgExplorerOpen] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<Record<Domain, boolean>>(defaultSelectedAgents);
  const [forceFullSweep, setForceFullSweep] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [topTab, setTopTab] = useState<'intelligence' | 'usage' | 'steal'>('intelligence');
  const [viewMode, setViewMode] = useState<import('@/types/chat-ui').ProductViewMode>('executive');

  const currentResult = [...messages].reverse().find((m) => m.role === 'assistant');

  useEffect(() => {
    resetHeaderCompress();
  }, [currentSessionId, resetHeaderCompress]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('veracity_product_mode') as import('@/types/chat-ui').ProductViewMode | null;
      if (saved && ['executive', 'business', 'analyst', 'developer'].includes(saved)) {
        setViewMode(saved);
      }
    } catch {}
  }, []);

  const handleViewModeChange = useCallback((mode: import('@/types/chat-ui').ProductViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('veracity_product_mode', mode);
    } catch {}
  }, []);

  // Persist / restore adaptive agent selection per session
  useEffect(() => {
    setSelectedAgents(loadSelectedAgents(currentSessionId));
    setForceFullSweep(loadForceFullSweep(currentSessionId));
  }, [currentSessionId]);

  useEffect(() => {
    saveSelectedAgents(currentSessionId, selectedAgents);
  }, [currentSessionId, selectedAgents]);

  useEffect(() => {
    saveForceFullSweep(currentSessionId, forceFullSweep);
  }, [currentSessionId, forceFullSweep]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const followUpEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, []);

  useEffect(() => { autoResizeTextarea(); }, [inputValue, autoResizeTextarea]);

  const recentQueries = messages.filter(m => m.role === 'user').map(m => m.content);
  const hasResult = !!(currentResult?.orchestratorOutput);
  const completedCount = currentResult?.agentRuns?.filter(r => r.status === 'completed').length ?? 0;
  const totalCount = currentResult?.agentRuns?.length ?? 0;
  const selectedAgentIds = ALL_DOMAINS.filter(d => selectedAgents[d]);
  const orchLogLen = currentResult?.orchestrationLog?.length ?? 0;
  const orchestrationLines = currentResult?.orchestrationLog ?? [];
  const userMemory = memoryQuery.data ?? null;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
  }, [supabase]);

  useEffect(() => {
    if (!featureFlags.workspaces) return;
    void fetch('/api/workspaces', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { activeWorkspaceId?: string } | null) => {
        setActiveWorkspaceId(d?.activeWorkspaceId ?? null);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!featureFlags.alerts) return;
    const loadUnread = () => {
      void fetch('/api/alerts?unread=1')
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { alerts?: unknown[] } | null) => {
          setAlertsUnread(d?.alerts?.length ?? 0);
        })
        .catch(() => {});
    };
    loadUnread();
    const id = window.setInterval(loadUnread, 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (followUps.length > 0) followUpEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [followUps]);

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/auth'); router.refresh(); };
  const resetDraftInput = useCallback(() => {
    setInputValue('');
    setAttachedImages([]);
    requestAnimationFrame(autoResizeTextarea);
  }, [autoResizeTextarea]);
  const {
    isLoading, isFollowingUp, mirofishRunning, sessionUsage, handleSend, handleFollowUp,
    handleComposerSend, handleExecutionPlanRefined, resetSessionUsage,
    activeJobId, compareBaseline, cancelActiveJob, requestFullSweepCompare, clearCompareBaseline,
  } = useChatOrchestration({
    messages, setMessages, followUps, setFollowUps, currentSessionId, setCurrentSessionId,
    selectedAgentIds, selectedAgents, forceFullSweep, streamChat, userMemory, refreshUserMemory: async () => { await memoryQuery.refetch(); },
    refreshSessions, resetDraftInput,
  });

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const imgs = await Promise.all(files.map(async file => {
      const dataUrl = await readFileAsBase64(file);
      const [prefix, data] = dataUrl.split(',');
      const mimeType = prefix.split(':')[1].split(';')[0];
      return { dataUrl, data, mimeType, name: file.name } as AttachedImage;
    }));
    setAttachedImages(prev => [...prev, ...imgs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);
  const handleNewQuery = useCallback(() => {
    resetConversation();
    setExpandedDomain(null);
    setAttachedImages([]);
    resetSessionUsage();
  }, [resetConversation, resetSessionUsage]);
  const getRunFor = (d: Domain) => getRunForDomain(currentResult?.agentRuns, d);
  const getOutputFor = (d: Domain) => getOutputForDomain(currentResult?.orchestratorOutput, d);
  const pipelineStages: PipelineStage[] = buildPipelineStages({
    orchestrationLines,
    agentRuns: currentResult?.agentRuns,
    orchestratorOutput: currentResult?.orchestratorOutput,
    isLoading,
    executionEnabled: selectedAgents['execution-engine'],
  });
  const expandedOutput = expandedDomain ? getOutputFor(expandedDomain) : null;
  const visibleTabDomains = ALL_DOMAINS.filter(d => {
    const run = getRunFor(d);
    const output = getOutputFor(d);
    return !!run || !!output || d === 'mirofish';
  });
  const sidebarBg = surface;
  const headerBg = surface;
  const borderC = border;
  const textMain = text;
  const cardBg = surface;
  const cardBg2 = surface2;
  const neuExtruded = 'var(--shadow-extruded)';
  const neuExtrudedSm = 'var(--shadow-extruded-sm)';
  const accentInk = accent;
  const composerProps = useMemo(() => ({
    inputValue, onInputChange: setInputValue, attachedImages, fileInputRef, onFileChange: handleFileChange,
    textareaRef, onTextareaInput: autoResizeTextarea, onAttachClick: () => fileInputRef.current?.click(),
    onRemoveImage: (i: number) => setAttachedImages(prev => prev.filter((_, j) => j !== i)),
    headerBg, cardBg, cardBg2, textMain, textMuted, textSubtle, accentInk, neuExtruded, neuExtrudedSm, isDark,
  }), [accentInk, attachedImages, autoResizeTextarea, cardBg, cardBg2, handleFileChange, headerBg, inputValue, isDark, textMain, textMuted, textSubtle]);

  return (
    <div className={isDark ? 'dark' : 'light'} style={{ display: 'contents' }}>
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">

      <SessionSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
        onNewQuery={handleNewQuery}
        sessions={sessions}
        loadingSessions={loadingSessions}
        currentSessionId={currentSessionId}
        onLoadSession={(id) => { void loadSession(id); }}
        onDeleteSession={(id) => deleteSession(id)}
        selectedAgents={selectedAgents}
        onToggleAgent={(domain) => setSelectedAgents((prev) => ({ ...prev, [domain]: !prev[domain] }))}
        forceFullSweep={forceFullSweep}
        onToggleForceFullSweep={() => setForceFullSweep((v) => !v)}
        getRunForDomain={getRunFor}
        sidebarBg={sidebarBg}
        cardBg2={cardBg2}
        neuExtrudedSm={neuExtrudedSm}
        textMain={textMain}
        textMuted={textMuted}
        textSubtle={textSubtle}
      />

      {/* ═══════════════════════════════════ MAIN ══ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        <DashboardHeader
          headerIslandRef={headerIslandRef}
          headerCompact={headerCompact}
          sidebarCollapsed={sidebarCollapsed}
          headerBg={headerBg}
          topTab={topTab}
          onTopTabChange={setTopTab}
          selectedAgents={selectedAgents}
          mirofishRunning={mirofishRunning}
          onOpenAgents={() => setAgentsDrawerOpen(true)}
          onOpenMemory={() => setMemoryDrawerOpen(true)}
          onOpenAlerts={() => setAlertsOpen(true)}
          alertsUnread={alertsUnread}
          onOpenMembers={() => setMembersOpen(true)}
          onOpenOrgIntel={() => setOrgIntelOpen(true)}
          onOpenKgExplorer={() => setKgExplorerOpen(true)}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          userEmail={userEmail}
          showUserMenu={showUserMenu}
          onToggleUserMenu={() => setShowUserMenu(v => !v)}
          onSignOut={() => { void handleSignOut(); }}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          textMuted={textMuted}
          textSubtle={textSubtle}
          accentInk={accentInk}
        />

        <DashboardWorkspace
          topTab={topTab}
          mainScrollRef={mainScrollRef}
          onMainScroll={onMainScroll}
          currentResult={currentResult}
          currentSessionId={currentSessionId}
          messages={messages}
          followUps={followUps}
          followUpEndRef={followUpEndRef}
          isLoading={isLoading}
          isFollowingUp={isFollowingUp}
          hasResult={hasResult}
          recentQuery={recentQueries[recentQueries.length - 1] ?? 'analysing…'}
          pipelineStages={pipelineStages}
          orchLogLen={orchLogLen}
          orchestrationLines={orchestrationLines}
          visibleTabDomains={visibleTabDomains}
          expandedDomain={expandedDomain}
          onSelectDomain={setExpandedDomain}
          getRunForDomain={getRunFor}
          getOutputForDomain={getOutputFor}
          completedCount={completedCount}
          totalCount={totalCount}
          ratedRecs={ratedRecs}
          onRate={(key, rating) => setRatedRecs((prev) => ({ ...prev, [key]: rating }))}
          onFollowUpSuggestion={(sug) => { void handleFollowUp(sug); }}
          onSendDemoQuery={(q) => { void handleSend(q, []); }}
          onComposerSend={(text) => handleComposerSend(text, hasResult, attachedImages)}
          onPlanRefined={handleExecutionPlanRefined}
          composerProps={composerProps}
          sessionUsage={sessionUsage}
          queryCacheStats={queryCacheStats}
          selectedAgentIds={selectedAgentIds}
          progressPct={currentResult?.progressPct}
          missionSummary={currentResult?.missionSummary}
          missionSteps={currentResult?.orchestratorOutput?.missionPlan?.steps
            ?? (currentResult?.missionSummary?.steps as Array<{ id: string; label: string; agentId: string }> | undefined)}
          activeJobId={activeJobId ?? currentResult?.activeJobId}
          onCancelJob={() => { void cancelActiveJob(); }}
          compareBaseline={compareBaseline}
          onRequestFullSweepCompare={requestFullSweepCompare}
          onClearCompare={clearCompareBaseline}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onResetHeader={resetHeaderCompress}
          chrome={{ cardBg, cardBg2, textMain, textMuted, textSubtle, accentInk, borderC, neuExtruded, neuExtrudedSm, isDark }}
        />
      </div>
    </div>

    <MemoryDrawer
      open={memoryDrawerOpen}
      onClose={() => setMemoryDrawerOpen(false)}
      memory={userMemory}
      textMain={textMain}
      textMuted={textMuted}
      textSubtle={textSubtle}
      cardBg={cardBg}
      cardBg2={cardBg2}
      neuExtruded={neuExtruded}
      neuExtrudedSm={neuExtrudedSm}
      accentInk={accentInk}
    />
    <AlertsDrawer open={alertsOpen} onClose={() => setAlertsOpen(false)} />
    <WorkspaceMembersDrawer
      open={membersOpen}
      onClose={() => setMembersOpen(false)}
      workspaceId={activeWorkspaceId}
    />
    <OrgIntelligencePanel open={orgIntelOpen} onClose={() => setOrgIntelOpen(false)} />
    <KnowledgeGraphExplorer open={kgExplorerOpen} onClose={() => setKgExplorerOpen(false)} />
    <AgentsDrawer
      open={agentsDrawerOpen}
      onClose={() => setAgentsDrawerOpen(false)}
      selectedAgents={selectedAgents}
      onToggleAgent={(domain) => setSelectedAgents((prev) => ({ ...prev, [domain]: !prev[domain] }))}
      forceFullSweep={forceFullSweep}
      onToggleForceFullSweep={() => setForceFullSweep((v) => !v)}
      getRunForDomain={getRunFor}
      textMain={textMain}
      textMuted={textMuted}
      textSubtle={textSubtle}
      accentInk={accentInk}
    />
    </div>
  );
}
