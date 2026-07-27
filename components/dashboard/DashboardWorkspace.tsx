'use client';

import React, { useEffect, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import type { RecommendationRating } from '@/lib/feedback';
import type { AttachedImage, ChatMessage, FollowUp, PipelineStage } from '@/types/chat-ui';
import type { Domain } from '@/lib/domain-meta';
import { ChatPanel } from '@/components/ui/ChatPanel';
import { AgentProgressGrid } from '@/components/ui/AgentProgressGrid';
import { PanelSkeleton } from '@/components/ui/PanelSkeleton';
import { AppErrorBoundary } from '@/components/ui/AppErrorBoundary';

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
const IntelligenceResults = dynamic(() => import('@/components/ui/IntelligenceResults').then((m) => m.IntelligenceResults), {
  loading: () => <PanelSkeleton label="Loading results" rows={5} height={360} />,
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
  onResetHeader,
  chrome,
}: Props) {
  const expandedOutput = expandedDomain ? getOutputForDomain(expandedDomain) : null;

  useLayoutEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [currentSessionId, topTab]);

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
              {messages.length === 0 && !isLoading && !hasResult && !currentResult && (
                <ChatPanel
                  showEmptyState
                  onDemoQuery={onSendDemoQuery}
                  followUps={[]}
                  isFollowingUp={false}
                  isLoading={isLoading}
                  showComposer={false}
                  onSend={onComposerSend}
                  {...composerProps}
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
                  onHidden={() => {
                    if (onResetHeader) {
                      onResetHeader();
                    }
                  }}
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
                  onSend={onComposerSend}
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
            onSend={onComposerSend}
            composerPlaceholder={hasResult ? 'Ask a follow-up about this analysis…' : 'Ask a growth intelligence question…'}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            {...composerProps}
          />
        </AppErrorBoundary>
      )}
    </>
  );
}
