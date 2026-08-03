'use client';

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown } from 'lucide-react';
import type { RecommendationRating } from '@/lib/feedback';
import type { AttachedImage, ChatMessage, FollowUp, PipelineStage } from '@/types/chat-ui';
import type { Domain } from '@/lib/domain-meta';
import { ChatPanel } from '@/components/ui/ChatPanel';
import { AgentProgressGrid } from '@/components/ui/AgentProgressGrid';
import { PanelSkeleton } from '@/components/ui/PanelSkeleton';
import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';

import { IntelligenceResults } from '@/components/ui/IntelligenceResults';
import { ConversationTimeline } from '@/components/ui/ConversationTimeline';
import type { MarketProject } from '@/lib/projects';
import type { ResearchTurnMode } from '@/lib/research-turn-mode';
import { MarketProjectOverview } from '@/components/projects/MarketProjectOverview';
import { ProjectDashboard } from '@/components/dashboard/ProjectDashboard';
import { StartTrackingCard } from '@/components/dashboard/StartTrackingCard';
import { HomeFeed } from '@/components/dashboard/HomeFeed';
import { DEMO_QUERIES } from '@/lib/domain-meta';
import { ScenarioPanel } from '@/components/dashboard/ScenarioPanel';
import { EntityCorrectionPanel } from '@/components/projects/EntityCorrectionPanel';
import { ArtifactAttachPicker } from '@/components/dashboard/ArtifactAttachPicker';
import type { AttachedArtifact } from '@/lib/intelligence/conversation-context';

const ApiUsagePanel = dynamic(() => import('@/components/ApiUsagePanel').then((m) => m.ApiUsagePanel), {
  loading: () => <PanelSkeleton label="Loading usage" height={280} />,
  ssr: false,
});
const StealStrategyPanel = dynamic(() => import('@/components/StealStrategyPanel').then((m) => m.StealStrategyPanel), {
  loading: () => <PanelSkeleton label="Loading steal strategy" height={320} />,
  ssr: false,
});
const ExpandedDomainPanel = dynamic(() => import('@/components/ui/ExpandedDomainPanel').then((m) => m.ExpandedDomainPanel), {
  loading: () => <PanelSkeleton label="Loading domain" height={240} />,
  ssr: false,
});
const ProfileSettingsView = dynamic(() => import('@/components/profile/ProfileSettingsView').then((m) => m.ProfileSettingsView), {
  loading: () => <PanelSkeleton label="Loading profile" height={320} />,
  ssr: false,
});
const WatchlistsView = dynamic(() => import('@/components/watchlists/WatchlistsView').then((m) => m.WatchlistsView), {
  loading: () => <PanelSkeleton label="Loading watchlists" height={320} />,
  ssr: false,
});

type ComposerProps = {
  inputValue: string;
  onInputChange: (value: string) => void;
  attachedImages: AttachedImage[];
  onRemoveImage: (index: number) => void;
  onAttachClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
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

import { DashboardHeader, TopTab } from '@/components/ui/DashboardHeader';

type Props = {
  topTab: TopTab;
  userEmail?: string | null;
  userMemory?: import('@/lib/memory').UserMemory | null;
  mainScrollRef: React.RefObject<HTMLDivElement | null>;
  onMainScroll: () => void;
  currentResult?: ChatMessage;
  currentSessionId: string | null;
  selectedProject?: MarketProject | null;
  /** Select the new project and refresh the sidebar list. */
  onProjectCreated?: (project: MarketProject) => void;
  /** Home links into the research tab, so it needs to switch tabs. */
  onTopTabChange?: (tab: TopTab) => void;
  /** Reopen a past research session from Home. */
  onOpenSession?: (sessionId: string) => void;
  messages: ChatMessage[];
  followUps: FollowUp[];
  followUpEndRef: React.RefObject<HTMLDivElement | null>;
  isLoading: boolean;
  isFollowingUp: boolean;
  hasResult: boolean;
  recentQuery: string;
  pipelineStages: PipelineStage[];
  orchLogLen: number;
  orchestrationLines: string[];
  visibleTabDomains: Domain[];
  expandedDomain: Domain | null;
  onSelectDomain: (domain: Domain | null) => void;
  getRunForDomain: (domain: Domain) => any;
  getOutputForDomain: (domain: Domain) => any;
  completedCount: number;
  totalCount: number;
  ratedRecs: Record<string, RecommendationRating>;
  onRate: (key: string, rating: RecommendationRating) => void;
  onFollowUpSuggestion: (text: string) => void;
  onSendDemoQuery: (text: string) => void;
  onComposerSend: (text: string) => void;
  onPlanRefined: (result: any) => void;
  composerProps: ComposerProps;
  sessionUsage: { queries: number; totalCostUsd: number; totalLatencyMs: number; totalGeminiCalls: number; totalToolCalls: number };
  queryCacheStats: { hits: number; misses: number };
  selectedAgentIds?: string[];
  progressPct?: number;
  missionSummary?: Record<string, unknown> | null;
  missionSteps?: Array<{ id: string; label: string; agentId: string; dependsOn?: string[]; rationale?: string }>;
  activeJobId?: string | null;
  onCancelJob?: () => void;
  compareBaseline?: ChatMessage | null;
  onRequestFullSweepCompare?: () => void;
  onClearCompare?: () => void;
  viewMode?: import('@/types/chat-ui').ProductViewMode;
  onViewModeChange?: (mode: import('@/types/chat-ui').ProductViewMode) => void;
  turnMode?: ResearchTurnMode;
  onTurnModeChange?: (mode: ResearchTurnMode) => void;
  onResetHeader?: () => void;
  chrome: {
    cardBg: string;
    cardBg2: string;
    textMain: string;
    textMuted: string;
    textSubtle: string;
    accentInk: string;
    borderC: string;
    neuExtruded: string;
    neuExtrudedSm: string;
    isDark: boolean;
  };
};

export function DashboardWorkspace({
  topTab,
  userEmail,
  userMemory,
  mainScrollRef,
  onMainScroll,
  currentResult,
  currentSessionId,
  selectedProject,
  onProjectCreated,
  onTopTabChange,
  onOpenSession,
  messages,
  followUps,
  followUpEndRef,
  isLoading,
  isFollowingUp,
  hasResult,
  recentQuery,
  pipelineStages,
  orchLogLen,
  orchestrationLines,
  visibleTabDomains,
  expandedDomain,
  onSelectDomain,
  getRunForDomain,
  getOutputForDomain,
  completedCount,
  totalCount,
  ratedRecs,
  onRate,
  onFollowUpSuggestion,
  onSendDemoQuery,
  onComposerSend,
  onPlanRefined,
  composerProps,
  sessionUsage,
  queryCacheStats,
  selectedAgentIds,
  progressPct,
  missionSummary,
  missionSteps,
  activeJobId,
  onCancelJob,
  compareBaseline,
  onRequestFullSweepCompare,
  onClearCompare,
  viewMode,
  onViewModeChange,
  turnMode,
  onTurnModeChange,
  onResetHeader,
  chrome,
}: Props) {
  const expandedOutput = expandedDomain ? getOutputForDomain(expandedDomain) : null;

  // Artifacts attached to the next turn. Held here rather than in the composer
  // so they survive the composer remounting between result states.
  const [attachedArtifacts, setAttachedArtifacts] = useState<AttachedArtifact[]>([]);

  // Collapsed by default: the conversation leads this tab, not the project's
  // standing panels. See the note above the disclosure.
  const [showProjectDetail, setShowProjectDetail] = useState(false);

  /**
   * Send with any attached artifacts appended as explicit references.
   *
   * The reference travels in the message text so it reaches the research path
   * without a new transport: the turn then carries what the user pointed at
   * instead of the model guessing which chart or change was meant.
   */
  const sendWithArtifacts = useCallback(
    (text: string) => {
      if (attachedArtifacts.length === 0) {
        onComposerSend(text);
        return;
      }
      const context = attachedArtifacts
        .map((a) => `[${a.kind}] ${a.label}: ${a.detail}`)
        .join('\n');
      onComposerSend(`${text}\n\nReferring to:\n${context}`);
      setAttachedArtifacts([]);
    },
    [attachedArtifacts, onComposerSend],
  );
  const handleAgentProgressHidden = useCallback(() => {
    onResetHeader?.();
  }, [onResetHeader]);

  useLayoutEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [currentSessionId, mainScrollRef, topTab]);

  return (
    <>
      <div
        ref={mainScrollRef}
        onScroll={onMainScroll}
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: hasResult ? '12px' : 'clamp(16px, 3vw, 32px)',
          paddingRight: 'clamp(16px, 3vw, 32px)',
          paddingBottom: 'clamp(24px, 4vw, 40px)',
          paddingLeft: 'clamp(16px, 3vw, 32px)',
        }}
      >
        <div className={`flex flex-col ${hasResult ? 'gap-4' : 'gap-7'} max-w-[1400px] w-full mx-auto`}>
          {/*
            The landing screen. Answers "what changed while I was away?" from
            already-collected data — it never triggers research and never calls a
            model, so opening the app costs nothing.
          */}
          {topTab === 'home' && (
            <HomeFeed
              onOpenProject={(project) => {
                onProjectCreated?.(project);
                onTopTabChange?.('intelligence');
              }}
              onStartTracking={() => onTopTabChange?.('intelligence')}
              onOpenSession={(sessionId) => {
                onOpenSession?.(sessionId);
                onTopTabChange?.('intelligence');
              }}
            />
          )}
          {topTab === 'usage' && (
            <ApiUsagePanel
              lastMetrics={currentResult?.orchestratorOutput?.metrics}
              lastLive={currentResult?.liveMetrics}
              sessionTotals={sessionUsage}
              queryCacheStats={queryCacheStats}
              sessionId={currentSessionId}
              agentsSavedVsFull={currentResult?.orchestratorOutput?.selectionMeta?.savedVsFull ?? null}
            />
          )}
          {topTab === 'steal' && <StealStrategyPanel />}
          {topTab === 'watchlists' && <WatchlistsView />}
          {topTab === 'profile' && <ProfileSettingsView userEmail={userEmail ?? null} userMemory={userMemory} />}
          {topTab === 'intelligence' && (
            <>
              {selectedProject && (
                <div className="veracity-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="ui-section-label text-accent">Active market project</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{selectedProject.name} · {selectedProject.product}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedProject.competitors.length ? `${selectedProject.competitors.length} competitors` : 'No competitors yet'}
                      {selectedProject.geography ? ` · ${selectedProject.geography}` : ''}
                      {selectedProject.decision_context ? ` · ${selectedProject.decision_context}` : ''}
                    </p>
                  </div>
                  {messages.length === 0 && !isLoading ? (
                    <button
                      type="button"
                      onClick={() => onComposerSend(`Build a market baseline for ${selectedProject.product}. Compare the tracked competitors, summarize current positioning, pricing, market signals, evidence gaps, and the most important decision implications${selectedProject.decision_context ? ` for this decision: ${selectedProject.decision_context}` : ''}.`)}
                      className="shrink-0 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-accent-foreground hover:opacity-90"
                    >
                      Run baseline
                    </button>
                  ) : null}
                </div>
              )}
              {/*
                Lead with change, not a blank prompt.
                A returning user should see what happened while they were away
                before they are asked to remember what they were tracking and
                re-type it. This is what makes a second visit worth more than
                the first, so it sits above the static project overview.
              */}
              {/*
                Project detail, collapsed by default.

                These four panels used to sit permanently above the conversation,
                so starting new research left a wall of the previous project on
                screen and the reset looked like it had not happened. The
                conversation is what this tab is for; the project's standing
                detail is reference material you open when you want it.
              */}
              {selectedProject && (
                <button
                  type="button"
                  onClick={() => setShowProjectDetail((v) => !v)}
                  className="self-start flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${showProjectDetail ? 'rotate-180' : ''}`}
                  />
                  {showProjectDetail ? 'Hide project detail' : 'Show project detail'}
                </button>
              )}
              {showProjectDetail && (
                <>
              {selectedProject ? (
                <ProjectDashboard
                  projectId={selectedProject.id}
                  onAskAbout={onComposerSend}
                />
              ) : null}
              {/*
                Stress-testing and evidence review sit alongside the research
                itself. Both are things a user does *about* the project, so
                putting them behind a separate screen would mean the review
                nobody navigates to is the review nobody does.
              */}
              {selectedProject ? <ScenarioPanel project={selectedProject} /> : null}
              {selectedProject ? <EntityCorrectionPanel projectId={selectedProject.id} /> : null}

              {selectedProject ? (
                <MarketProjectOverview
                  projectId={selectedProject.id}
                  refreshKey={currentResult?.persistedId ?? currentResult?.id ?? null}
                />
              ) : null}
              {/*
                What a first-time visitor sees.

                Without a project, the entire returning-user surface — dashboard,
                ledger, charts, timeline — cannot render, because every one of
                those is gated on `selectedProject` below. The old empty state
                offered only question chips, so people asked one question, judged
                the product on a single-shot answer, and never reached the part
                that makes it worth returning to.

                So: setup leads, and asking a one-off stays available underneath.
                Once a project exists, the question prompt is the right lead again.
              */}
                </>
              )}
              {messages.length === 0 && !isLoading && !hasResult && !currentResult && !selectedProject && (
                <StartTrackingCard onCreated={(project) => onProjectCreated?.(project)}>
                  <details className="veracity-card p-5 group">
                    <summary className="cursor-pointer text-sm font-medium text-foreground list-none flex items-center justify-between">
                      <span>Just ask a one-off question instead</span>
                      <ChevronDown
                        size={15}
                        className="text-muted-foreground transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="mt-2 text-xs text-muted-foreground">
                      You get one answer, and we forget it. Tracking keeps watching
                      and tells you what changed.
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      {DEMO_QUERIES.map((query) => (
                        <button
                          key={query}
                          type="button"
                          onClick={() => onSendDemoQuery(query)}
                          className="text-left text-sm text-accent hover:underline"
                        >
                          {query}
                        </button>
                      ))}
                    </div>
                  </details>
                </StartTrackingCard>
              )}
              {messages.length === 0 && !isLoading && !hasResult && !currentResult && selectedProject && (
                <ChatPanel
                  showEmptyState
                  onDemoQuery={onSendDemoQuery}
                  followUps={[]}
                  isFollowingUp={false}
                  isLoading={isLoading}
                  showComposer={false}
                  onSend={sendWithArtifacts}
                  {...composerProps}
                />
              )}
              {selectedProject ? (
                <ArtifactAttachPicker
                  projectId={selectedProject.id}
                  attached={attachedArtifacts}
                  onChange={setAttachedArtifacts}
                />
              ) : null}

              {messages.length > 0 && (
                <ConversationTimeline
                  messages={messages}
                  currentResultId={currentResult?.id}
                  textMain={chrome.textMain}
                  textMuted={chrome.textMuted}
                  textSubtle={chrome.textSubtle}
                  cardBg={chrome.cardBg}
                  cardBg2={chrome.cardBg2}
                  accentInk={chrome.accentInk}
                  neuExtrudedSm={chrome.neuExtrudedSm}
                />
              )}
              <AppErrorBoundary label="Agent progress">
                <AgentProgressGrid
                  queryLabel={recentQuery}
                  userImages={messages.filter((m) => m.role === 'user').pop()?.images}
                  isLoading={isLoading}
                  pipelineStages={pipelineStages}
                  orchLogLen={orchLogLen}
                  visibleTabDomains={visibleTabDomains}
                  expandedDomain={expandedDomain}
                  onSelectDomain={(domain) => onSelectDomain(domain)}
                  getRunForDomain={getRunForDomain}
                  getOutputForDomain={getOutputForDomain}
                  completedCount={completedCount}
                  totalCount={totalCount}
                  orchestrationLines={orchestrationLines}
                  selectedAgentIds={selectedAgentIds}
                  product={currentResult?.orchestratorOutput?.product}
                  competitor={currentResult?.orchestratorOutput?.competitor}
                  progressPct={progressPct}
                  missionSummary={missionSummary}
                  missionSteps={missionSteps}
                  activeJobId={activeJobId}
                  onCancelJob={onCancelJob}
                  onHidden={handleAgentProgressHidden}
                  {...chrome}
                />
              </AppErrorBoundary>
              {expandedDomain && (
                <ExpandedDomainPanel
                  domain={expandedDomain}
                  output={expandedOutput}
                  product={currentResult?.orchestratorOutput?.product ?? ''}
                  sessionId={currentSessionId}
                  messageId={currentResult?.persistedId ?? null}
                  onClose={() => onSelectDomain(null)}
                  onRefined={onPlanRefined}
                  isDark={chrome.isDark}
                  cardBg={chrome.cardBg}
                  textMain={chrome.textMain}
                  textMuted={chrome.textMuted}
                  accentInk={chrome.accentInk}
                />
              )}
              {currentResult && (
                <AppErrorBoundary label="Results">
                  <IntelligenceResults
                    currentResult={currentResult}
                    currentSessionId={currentSessionId}
                    ratedRecs={ratedRecs}
                    onRate={onRate}
                    isFollowingUp={isFollowingUp}
                    isLoading={isLoading}
                    onFollowUpSuggestion={onFollowUpSuggestion}
                    compareBaseline={compareBaseline}
                    onRequestFullSweepCompare={onRequestFullSweepCompare}
                    onClearCompare={onClearCompare}
                    viewMode={viewMode}
                    isDark={chrome.isDark}
                    cardBg={chrome.cardBg}
                    cardBg2={chrome.cardBg2}
                    textMain={chrome.textMain}
                    textMuted={chrome.textMuted}
                    textSubtle={chrome.textSubtle}
                    accentInk={chrome.accentInk}
                    borderC={chrome.borderC}
                    neuExtruded={chrome.neuExtruded}
                    neuExtrudedSm={chrome.neuExtrudedSm}
                  />
                </AppErrorBoundary>
              )}
              <AppErrorBoundary label="Chat panel">
                <ChatPanel
                  showEmptyState={false}
                  onDemoQuery={onSendDemoQuery}
                  followUps={followUps}
                  isFollowingUp={isFollowingUp}
                  isLoading={isLoading}
                  followUpEndRef={followUpEndRef}
                  showComposer={false}
                  onSend={sendWithArtifacts}
                  {...composerProps}
                />
              </AppErrorBoundary>
              <div className="h-4" />
            </>
          )}
        </div>
      </div>

      {topTab === 'intelligence' && (
        <AppErrorBoundary label="Composer">
          <ChatPanel
            showEmptyState={false}
            onDemoQuery={onSendDemoQuery}
            followUps={[]}
            isFollowingUp={isFollowingUp}
            isLoading={isLoading}
            showComposer
            onSend={sendWithArtifacts}
            composerPlaceholder={hasResult ? 'Ask a follow-up about this analysis…' : 'Ask a growth intelligence question…'}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            turnMode={turnMode}
            onTurnModeChange={onTurnModeChange}
            {...composerProps}
          />
        </AppErrorBoundary>
      )}
    </>
  );
}
