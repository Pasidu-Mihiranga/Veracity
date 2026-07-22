'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import type { AgentRun, OrchestratorOutput, AgentOutput, ExecutionPlanOutput, RefinementDelta } from '@/lib/agents/types';
import { useTheme } from '@/lib/theme-provider';
import {
  createSession, listSessions, saveMessage, loadMessages, deleteSession, type ChatSession,
} from '@/lib/conversations';
import {
  getUserMemory, extractAndUpdateMemory, buildMemoryContext, type UserMemory,
} from '@/lib/memory';
import type { RecommendationRating } from '@/lib/feedback';
import type {
  AttachedImage,
  ChatMessage,
  FollowUp,
  PipelineStage,
} from '@/types/chat-ui';
import {
  ALL_DOMAINS,
  type Domain,
} from '@/lib/domain-meta';
import {
  hydrateMessage,
  indexMessageInBackground,
  readFileAsBase64,
  recallContextForSession,
  toImageAttachments,
} from '@/lib/chat-client';
import {
  accumulateSessionUsage,
  applyAgentDomainResult,
  applyAgentUpdate,
  applyOrchestrationLog,
  applyResultToAssistant,
  isMirofishLiveFailed,
  mergeAgentOutputIntoFinal,
  recommendationsFromOutput,
  sourcesFromOutput,
} from '@/lib/chat-stream';
import { useChatStream } from '@/hooks/useChatStream';
import { SessionSidebar } from '@/components/ui/SessionSidebar';
import { AgentProgressGrid } from '@/components/ui/AgentProgressGrid';
import { ChatPanel } from '@/components/ui/ChatPanel';
import { DashboardHeader } from '@/components/ui/DashboardHeader';
import { PanelSkeleton } from '@/components/ui/PanelSkeleton';
import {
  buildPipelineStages,
  getOutputForDomain as getOutputForDomainFromRuns,
  getRunForDomain as getRunForDomainFromRuns,
} from '@/lib/agent-progress';

const ApiUsagePanel = dynamic(
  () => import('@/components/ApiUsagePanel').then((m) => m.ApiUsagePanel),
  { loading: () => <PanelSkeleton label="Loading usage" height={280} />, ssr: false },
);
const StealStrategyPanel = dynamic(
  () => import('@/components/StealStrategyPanel').then((m) => m.StealStrategyPanel),
  { loading: () => <PanelSkeleton label="Loading steal strategy" height={320} />, ssr: false },
);
const MemoryDrawer = dynamic(
  () => import('@/components/ui/MemoryDrawer').then((m) => m.MemoryDrawer),
  { ssr: false },
);
const ExpandedDomainPanel = dynamic(
  () => import('@/components/ui/ExpandedDomainPanel').then((m) => m.ExpandedDomainPanel),
  { loading: () => <PanelSkeleton label="Loading domain" height={240} />, ssr: false },
);
const IntelligenceResults = dynamic(
  () => import('@/components/ui/IntelligenceResults').then((m) => m.IntelligenceResults),
  { loading: () => <PanelSkeleton label="Loading results" rows={5} height={360} />, ssr: false },
);

type Message = ChatMessage;

/* ─── Main dashboard ─────────────────────────────────────── */
export default function VeracityDashboard() {
  const router   = useRouter();
  const supabase = createClient();
  const { streamChat } = useChatStream();
  const { isDark, toggle: toggleTheme, surface, surface2, text, textMuted, textSubtle, accent, border } = useTheme();
  const [messages, setMessages]           = useState<Message[]>([]);
  const [inputValue, setInputValue]       = useState('');
  const [isLoading, setIsLoading]         = useState(false);
  const [userEmail, setUserEmail]         = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu]   = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<Domain | null>(null);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [followUps, setFollowUps]         = useState<FollowUp[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isFollowingUp, setIsFollowingUp] = useState(false);
  // Track which recommendations the user has rated (key → rating)
  const [ratedRecs, setRatedRecs] = useState<Record<string, RecommendationRating>>({});
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [userMemory, setUserMemory] = useState<UserMemory | null>(null);
  const [mirofishRunning, setMirofishRunning] = useState(false);
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<Record<Domain, boolean>>(() =>
    Object.fromEntries(ALL_DOMAINS.map(d => [d, d !== 'mirofish-live'])) as Record<Domain, boolean>
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  /** Top header tabs: main intelligence vs usage vs steal strategy. */
  const [topTab, setTopTab] = useState<'intelligence' | 'usage' | 'steal'>('intelligence');
  const [headerCompact, setHeaderCompact] = useState(false);
  /** Rolling totals for API Usage tab (reset on new query). */
  const [sessionUsage, setSessionUsage] = useState({
    queries: 0,
    totalCostUsd: 0,
    totalLatencyMs: 0,
    totalGeminiCalls: 0,
    totalToolCalls: 0,
  });

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const followUpEndRef  = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const mainScrollRef   = useRef<HTMLDivElement>(null);
  const headerIslandRef = useRef<HTMLElement>(null);
  const headerCompress  = useRef(0);
  const headerTarget    = useRef(0);
  const headerRaf       = useRef(0);

  const autoResizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, []);

  // Keep the textarea height in sync when value is cleared programmatically
  // (e.g. after sending a long query).
  useEffect(() => {
    autoResizeTextarea();
  }, [inputValue, autoResizeTextarea]);

  const tickHeaderCompress = useCallback(() => {
    headerRaf.current = 0;
    const island = headerIslandRef.current;
    if (!island) return;

    const next = headerCompress.current + (headerTarget.current - headerCompress.current) * 0.14;
    headerCompress.current = Math.abs(headerTarget.current - next) < 0.001
      ? headerTarget.current
      : next;

    const t = headerCompress.current;
    island.style.setProperty('--hc', t.toFixed(4));
    const compact = t > 0.58;
    island.classList.toggle('header-island--compact', compact);
    setHeaderCompact(prev => (prev === compact ? prev : compact));

    if (headerCompress.current !== headerTarget.current) {
      headerRaf.current = requestAnimationFrame(tickHeaderCompress);
    }
  }, []);

  const onMainScroll = useCallback(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    // Map ~0–96px scroll into 0–1 with a soft ease-in curve
    const raw = Math.min(1, Math.max(0, el.scrollTop / 96));
    headerTarget.current = raw * raw * (3 - 2 * raw); // smoothstep
    if (!headerRaf.current) {
      headerRaf.current = requestAnimationFrame(tickHeaderCompress);
    }
  }, [tickHeaderCompress]);

  useEffect(() => () => {
    if (headerRaf.current) cancelAnimationFrame(headerRaf.current);
  }, []);

  // React's style={{ background }} can wipe --hc; restore after paint.
  useLayoutEffect(() => {
    const island = headerIslandRef.current;
    if (!island) return;
    island.style.setProperty('--hc', headerCompress.current.toFixed(4));
  });

  const currentResult  = [...messages].reverse().find(m => m.role === 'assistant');
  const recentQueries  = messages.filter(m => m.role === 'user').map(m => m.content);
  const hasResult      = !!(currentResult?.orchestratorOutput);
  const completedCount = currentResult?.agentRuns?.filter(r => r.status === 'completed').length ?? 0;
  const totalCount     = currentResult?.agentRuns?.length ?? 0;
  const selectedAgentIds = ALL_DOMAINS.filter(d => selectedAgents[d]);
  const orchLogLen     = currentResult?.orchestrationLog?.length ?? 0;
  const orchestrationLines = currentResult?.orchestrationLog ?? [];

  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    const s = await listSessions();
    setSessions(s);
    setLoadingSessions(false);
    return s;
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setExpandedDomain(null);
    setFollowUps([]);
    const stored = await loadMessages(sessionId);
    
    // Separate main messages from follow-ups based on metadata
    const mainMessages: Message[] = [];
    const loadedFollowUps: FollowUp[] = [];
    
    stored.forEach((m, i) => {
      const msg = hydrateMessage(m, i);
      if (m.metadata?.isFollowUp) {
        if (m.role === 'user') {
          loadedFollowUps.push({
            id: i,
            question: m.content,
            answer: '',
            loading: false,
          });
        } else if (m.role === 'assistant' && loadedFollowUps.length > 0) {
          const lastIndex = loadedFollowUps.length - 1;
          loadedFollowUps[lastIndex].answer = m.content;
          loadedFollowUps[lastIndex].sources = msg.sources;
        }
      } else {
        mainMessages.push(msg);
      }
    });
    
    setMessages(mainMessages);
    setFollowUps(loadedFollowUps);
  }, []);

  const refreshUserMemory = useCallback(async () => {
    try {
      const m = await getUserMemory();
      setUserMemory(m);
    } catch {
      // Non-fatal — chat still works without persistent memory
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    refreshSessions();
    refreshUserMemory();
  }, [refreshSessions, refreshUserMemory]);

  useEffect(() => {
    if (followUps.length > 0) followUpEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [followUps]);

  // Do not auto-open domain Analysis panel — results should lead with Decision.
  // Users can open domains from Domain details when needed.

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/auth'); router.refresh(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const imgs: AttachedImage[] = await Promise.all(files.map(async file => {
      const dataUrl = await readFileAsBase64(file);
      const [prefix, data] = dataUrl.split(',');
      const mimeType = prefix.split(':')[1].split(';')[0];
      return { dataUrl, data, mimeType, name: file.name };
    }));
    setAttachedImages(prev => [...prev, ...imgs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Swap a refined orchestration result back into the latest assistant message.
  // Used by ArtifactRenderer → ExecutionPlan's "Refine with feedback" flow.
  // We persist the updated orchestratorOutput so future page loads see
  // the latest cycle (including feedback-aware research updates).
  const handleExecutionPlanRefined = useCallback((result: {
    plan: ExecutionPlanOutput;
    orchestratorOutput?: OrchestratorOutput;
    changes?: RefinementDelta[];
  }) => {
    const { plan, orchestratorOutput, changes } = result;
    setMessages(prev => prev.map(m => {
      if (m.role !== 'assistant' || !m.orchestratorOutput) return m;
      // Only the most recent assistant message gets refined.
      const latestAssistant = [...prev].reverse().find(x => x.role === 'assistant');
      if (m.id !== latestAssistant?.id) return m;

      const updatedOutputs = m.orchestratorOutput.outputs
        .filter(o => o.artifactType !== 'execution-plan')
        .concat(plan);

      const updatedOutput: OrchestratorOutput = orchestratorOutput
        ? {
          ...orchestratorOutput,
          outputs: orchestratorOutput.outputs?.length ? orchestratorOutput.outputs : updatedOutputs,
        }
        : {
          ...m.orchestratorOutput,
          outputs: updatedOutputs,
        };

      const deltaLines = (changes ?? []).slice(0, 3).map(d => `- ${d.summary}`);
      const refinedContent = updatedOutput.synthesizedAnswer || (
        deltaLines.length
          ? `${m.content}\n\nFeedback-driven updates:\n${deltaLines.join('\n')}`
          : m.content
      );

      // Best-effort persistence so a later reload reflects the refinement.
      if (currentSessionId && m.persistedId) {
        // Re-save as a new message row rather than mutating the prior row
        // (we don't have an updateMessage helper and keeping history append-only
        // makes the feedback loop auditable).
        saveMessage(currentSessionId, 'assistant', refinedContent, {
          type: 'intelligence',
          orchestratorOutput: updatedOutput,
          recommendations: m.recommendations,
          sources: m.sources,
          suggestions: m.suggestions,
          agentRuns: m.agentRuns,
          refinedFrom: m.persistedId,
        }).then(newId => {
          if (!newId) return;
          setMessages(prev2 => prev2.map(mm =>
            mm.id === m.id ? { ...mm, persistedId: newId } : mm
          ));
        });
      }

      return { ...m, content: refinedContent, orchestratorOutput: updatedOutput };
    }));
  }, [currentSessionId]);

  const handleSend = async (text: string, imagesToSend?: AttachedImage[]) => {
    const images = imagesToSend ?? attachedImages;
    const effectiveText = text.trim() || (images.length > 0 ? 'Analyse the attached image(s).' : '');
    if (!effectiveText || isLoading) return;
    if (selectedAgentIds.length === 0) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        type: 'text',
        content: 'Select at least one agent before running the query.',
      }]);
      return;
    }

    setExpandedDomain(null);
    setFollowUps([]);

    const userMsg: Message = { id: Date.now(), role: 'user', content: effectiveText, images: images.length > 0 ? images : undefined };
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setAttachedImages([]);
    setIsLoading(true);
    requestAnimationFrame(autoResizeTextarea);

    const assistantId = Date.now() + 1;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', type: 'intelligence', content: '', agentRuns: [], orchestrationLog: [] }]);

    const imagePayloads = toImageAttachments(images);

    const streamState: { finalOutput: OrchestratorOutput | null } = { finalOutput: null };

    const recalledContext = currentSessionId
      ? await recallContextForSession(currentSessionId, effectiveText)
      : '';
    const userMemoryContext = userMemory ? buildMemoryContext(userMemory) : '';
    const memoryContext = [userMemoryContext, recalledContext].filter(Boolean).join('\n\n');

    try {
      await streamChat(
        {
          query: effectiveText,
          history,
          images: imagePayloads,
          memoryContext,
          includeMirofish: selectedAgents.mirofish,
          includeMirofishLive: selectedAgents['mirofish-live'],
          selectedAgents: selectedAgentIds,
        },
        (chunk) => {
          if (chunk.type === 'agent_update') {
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? applyAgentUpdate(m, chunk.run, chunk.metrics)
                : m,
            ));
            return;
          }

          if (chunk.type === 'orchestration_log' && typeof chunk.line === 'string') {
            setMessages(prev => prev.map(m =>
              m.id === assistantId ? applyOrchestrationLog(m, chunk.line) : m,
            ));
            return;
          }

          if (chunk.type === 'result') {
            const out: OrchestratorOutput = chunk.output;
            streamState.finalOutput = out;
            setSessionUsage(prev => accumulateSessionUsage(prev, out.metrics));
            if (selectedAgents.mirofish) setMirofishRunning(true);
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? applyResultToAssistant(m, out, {
                  includeMirofish: selectedAgents.mirofish,
                  includeMirofishLive: selectedAgents['mirofish-live'],
                })
                : m,
            ));
            return;
          }

          if (chunk.type === 'mirofish_result') {
            const mirofishOut: AgentOutput = chunk.output;
            const run = {
              agentId: 'mirofish',
              name: 'MiroFish (Forecast)',
              status: 'completed',
              confidence: mirofishOut.confidence,
            } as AgentRun;
            if (streamState.finalOutput) {
              streamState.finalOutput = mergeAgentOutputIntoFinal(
                streamState.finalOutput,
                mirofishOut,
                'mirofish',
                run,
              );
            }
            setMirofishRunning(false);
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? applyAgentDomainResult(m, mirofishOut, 'mirofish', run)
                : m,
            ));
            return;
          }

          if (chunk.type === 'mirofish_live_result') {
            const liveOut: AgentOutput = chunk.output;
            const liveFailed = isMirofishLiveFailed(liveOut);
            const run = {
              agentId: 'mirofish-live',
              name: 'MiroFish Live (Real VPS)',
              status: liveFailed ? 'failed' : 'completed',
              confidence: liveOut.confidence,
            } as AgentRun;
            if (streamState.finalOutput) {
              streamState.finalOutput = mergeAgentOutputIntoFinal(
                streamState.finalOutput,
                liveOut,
                'mirofish-live',
                run,
              );
            }
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? applyAgentDomainResult(m, liveOut, 'mirofish-live', run)
                : m,
            ));
            return;
          }

          if (chunk.type === 'error') {
            setMessages(prev => prev.map(m =>
              m.id === assistantId
                ? { ...m, content: `Analysis failed: ${chunk.message}`, type: 'text' }
                : m,
            ));
          }
        },
      );
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to connect. Please try again.';
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: message } : m
      ));
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, orchestrationLog: undefined } : m
      ));
      setIsLoading(false);
      setMirofishRunning(false);
    }

    const finalOutput = streamState.finalOutput;

    let sessionId = currentSessionId;

    if (!sessionId) {
      const title = effectiveText.slice(0, 60) + (effectiveText.length > 60 ? '...' : '');
      const session = await createSession(title);
      if (session) {
        sessionId = session.id;
        setCurrentSessionId(session.id);
        await refreshSessions();
      }
    }

    if (sessionId) {
      await saveMessage(sessionId, 'user', effectiveText, {
        images: images.length > 0 ? images : undefined,
      });
      indexMessageInBackground(sessionId, 'user', effectiveText);

      if (finalOutput) {
        const sources = sourcesFromOutput(finalOutput, 12);

        const persistedAssistantId = await saveMessage(sessionId, 'assistant', finalOutput.synthesizedAnswer, {
          type: 'intelligence',
          orchestratorOutput: finalOutput,
          recommendations: recommendationsFromOutput(finalOutput),
          sources,
          suggestions: finalOutput.suggestedFollowUps?.slice(0, 3),
          agentRuns: finalOutput.agentRuns,
        });

        // Stamp the live in-memory message with the Supabase row id so the
        // "Refine with feedback" button can pass a real messageId to /api/refine.
        if (persistedAssistantId) {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, persistedId: persistedAssistantId } : m
          ));
        }

        indexMessageInBackground(sessionId, 'assistant', finalOutput.synthesizedAnswer);

        // Fire-and-forget durable memory extraction (role/company/products/competitors).
        // Never blocks the UI; refreshes local memory once it returns so the next
        // turn already carries the new facts in its memoryContext.
        if (userMemory) {
          extractAndUpdateMemory(sessionId, effectiveText, finalOutput.synthesizedAnswer, userMemory)
            .then(() => refreshUserMemory())
            .catch(() => {});
        }
      }
    }
  };

  const handleFollowUp = async (text: string) => {
    if (!text.trim() || isFollowingUp || isLoading) return;
    const fuId = Date.now();
    setFollowUps(prev => [...prev, { id: fuId, question: text, answer: '', loading: true }]);
    setFollowUpInput('');
    setIsFollowingUp(true);

    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Append previous follow-ups so the new follow-up has the full context
    for (const fu of followUps) {
      if (fu.question) history.push({ role: 'user', content: fu.question });
      if (fu.answer && !fu.loading) history.push({ role: 'assistant', content: fu.answer });
    }

    const recalledContext = currentSessionId
      ? await recallContextForSession(currentSessionId, text)
      : '';
    const userMemoryContext = userMemory ? buildMemoryContext(userMemory) : '';
    const memoryContext = [userMemoryContext, recalledContext].filter(Boolean).join('\n\n');
    const lowerFollowUp = text.toLowerCase();
    const followUpMode: 'full' | 'targeted' =
      (lowerFollowUp.includes('full rerun') || lowerFollowUp.includes('full refresh'))
        ? 'full'
        : 'targeted';

    try {
      await streamChat(
        {
          query: text,
          history,
          memoryContext,
          followUpMode,
          includeMirofish: selectedAgents.mirofish,
          selectedAgents: selectedAgentIds,
        },
        async (chunk) => {
          if (chunk.type !== 'result') return;
          const out: OrchestratorOutput = chunk.output;
          setSessionUsage(prev => accumulateSessionUsage(prev, out.metrics));
          const sources = sourcesFromOutput(out, 6);
          setFollowUps(prev => prev.map(f =>
            f.id === fuId ? { ...f, answer: out.synthesizedAnswer, sources, loading: false } : f
          ));

          if (currentSessionId) {
            await saveMessage(currentSessionId, 'user', text, { isFollowUp: true });
            await saveMessage(currentSessionId, 'assistant', out.synthesizedAnswer, {
              isFollowUp: true,
              sources,
            });
            indexMessageInBackground(currentSessionId, 'user', text);
            indexMessageInBackground(currentSessionId, 'assistant', out.synthesizedAnswer);

            if (userMemory) {
              extractAndUpdateMemory(currentSessionId, text, out.synthesizedAnswer, userMemory)
                .then(() => refreshUserMemory())
                .catch(() => {});
            }
          }
        },
      );
    } catch {
      setFollowUps(prev => prev.map(f =>
        f.id === fuId ? { ...f, answer: 'Follow-up failed. Please try again.', loading: false } : f
      ));
    } finally {
      setIsFollowingUp(false);
    }
  };

  const handleNewQuery  = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setFollowUps([]);
    setExpandedDomain(null);
    setAttachedImages([]);
    setSessionUsage({ queries: 0, totalCostUsd: 0, totalLatencyMs: 0, totalGeminiCalls: 0, totalToolCalls: 0 });
  };
  const getRunForDomain = useCallback(
    (d: Domain) => getRunForDomainFromRuns(currentResult?.agentRuns, d),
    [currentResult?.agentRuns],
  );
  const getOutputForDomain = useCallback(
    (d: Domain) => getOutputForDomainFromRuns(currentResult?.orchestratorOutput, d),
    [currentResult?.orchestratorOutput],
  );
  const pipelineStages: PipelineStage[] = buildPipelineStages({
    orchestrationLines,
    agentRuns: currentResult?.agentRuns,
    orchestratorOutput: currentResult?.orchestratorOutput,
    isLoading,
    executionEnabled: selectedAgents['execution-engine'],
  });

  const expandedOutput = expandedDomain ? getOutputForDomain(expandedDomain) : null;
  const visibleTabDomains = ALL_DOMAINS.filter(d => {
    const run = getRunForDomain(d);
    const output = getOutputForDomain(d);
    return !!run || !!output || d === 'mirofish';
  });

  /* ─ Theme surfaces (from lib/theme-tokens via ThemeProvider) ─ */
  const sidebarBg  = surface;
  const headerBg   = surface;
  const borderC    = border;
  const textMain   = text;
  const cardBg     = surface;
  const cardBg2    = surface2;
  const neuExtruded = 'var(--shadow-extruded)';
  const neuExtrudedSm = 'var(--shadow-extruded-sm)';
  const accentInk = accent;

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
        onDeleteSession={async (id) => {
          await deleteSession(id);
          if (currentSessionId === id) {
            handleNewQuery();
          }
          await refreshSessions();
        }}
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
          onOpenMemory={() => setMemoryDrawerOpen(true)}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          userEmail={userEmail}
          showUserMenu={showUserMenu}
          onToggleUserMenu={() => setShowUserMenu(v => !v)}
          onSignOut={() => { void handleSignOut(); }}
          textMuted={textMuted}
          textSubtle={textSubtle}
          accentInk={accentInk}
        />

        {/* ── Body ── */}
        <div
          ref={mainScrollRef}
          onScroll={onMainScroll}
          className="flex-1 overflow-y-auto"
          style={{ padding: 'clamp(16px, 3vw, 32px)', paddingBottom: 'clamp(24px, 4vw, 40px)' }}
        >
          <div className="flex flex-col gap-7 max-w-[1400px] w-full mx-auto">

            {topTab === 'usage' && (
              <ApiUsagePanel
                lastMetrics={currentResult?.orchestratorOutput?.metrics}
                lastLive={currentResult?.liveMetrics}
                sessionTotals={sessionUsage}
              />
            )}

            {topTab === 'steal' && <StealStrategyPanel />}

            {topTab === 'intelligence' && (
            <>
            <ChatPanel
              showEmptyState={messages.length === 0 && !isLoading}
              onDemoQuery={(q) => { void handleSend(q); }}
              followUps={[]}
              followUpInput=""
              onFollowUpInputChange={() => {}}
              onFollowUp={() => {}}
              isFollowingUp={false}
              isLoading={isLoading}
              hasResult={false}
              followUpEndRef={followUpEndRef}
              showComposer={false}
              inputValue={inputValue}
              onInputChange={setInputValue}
              onSend={(text) => { void handleSend(text); }}
              attachedImages={attachedImages}
              onRemoveImage={(i) => setAttachedImages(prev => prev.filter((_, j) => j !== i))}
              onAttachClick={() => fileInputRef.current?.click()}
              fileInputRef={fileInputRef}
              onFileChange={handleFileChange}
              textareaRef={textareaRef}
              onTextareaInput={autoResizeTextarea}
              headerBg={headerBg}
              cardBg={cardBg}
              cardBg2={cardBg2}
              textMain={textMain}
              textMuted={textMuted}
              textSubtle={textSubtle}
              accentInk={accentInk}
              neuExtruded={neuExtruded}
              neuExtrudedSm={neuExtrudedSm}
              isDark={isDark}
            />

            {/* Agent progress — loading only; hidden after results ready */}
            {isLoading && (
              <AgentProgressGrid
                queryLabel={recentQueries[recentQueries.length - 1] ?? 'analysing…'}
                userImages={messages.filter(m => m.role === 'user').pop()?.images}
                isLoading={isLoading}
                pipelineStages={pipelineStages}
                orchLogLen={orchLogLen}
                visibleTabDomains={visibleTabDomains}
                expandedDomain={expandedDomain}
                onSelectDomain={setExpandedDomain}
                getRunForDomain={getRunForDomain}
                getOutputForDomain={getOutputForDomain}
                completedCount={completedCount}
                totalCount={totalCount}
                isDark={isDark}
                cardBg={cardBg}
                cardBg2={cardBg2}
                textMain={textMain}
                textMuted={textMuted}
                textSubtle={textSubtle}
                accentInk={accentInk}
                borderC={borderC}
                neuExtrudedSm={neuExtrudedSm}
              />
            )}

            {expandedDomain && (
              <ExpandedDomainPanel
                domain={expandedDomain}
                output={expandedOutput}
                product={currentResult?.orchestratorOutput?.product ?? ''}
                sessionId={currentSessionId}
                messageId={currentResult?.persistedId ?? null}
                onClose={() => setExpandedDomain(null)}
                onRefined={handleExecutionPlanRefined}
                isDark={isDark}
                cardBg={cardBg}
                textMain={textMain}
                textMuted={textMuted}
                accentInk={accentInk}
              />
            )}

            {currentResult && (
              <IntelligenceResults
                currentResult={currentResult}
                currentSessionId={currentSessionId}
                ratedRecs={ratedRecs}
                onRate={(key, rating) => setRatedRecs(prev => ({ ...prev, [key]: rating }))}
                isFollowingUp={isFollowingUp}
                isLoading={isLoading}
                onFollowUpSuggestion={(sug) => { void handleFollowUp(sug); }}
                followUpEndRef={followUpEndRef}
                isDark={isDark}
                cardBg={cardBg}
                cardBg2={cardBg2}
                textMain={textMain}
                textMuted={textMuted}
                textSubtle={textSubtle}
                accentInk={accentInk}
                borderC={borderC}
                neuExtruded={neuExtruded}
                neuExtrudedSm={neuExtrudedSm}
              />
            )}

            {/* ── Follow-ups + composer affordances ── */}
            <ChatPanel
              showEmptyState={false}
              onDemoQuery={(q) => { void handleSend(q); }}
              followUps={followUps}
              followUpInput={followUpInput}
              onFollowUpInputChange={setFollowUpInput}
              onFollowUp={(text) => { void handleFollowUp(text); }}
              isFollowingUp={isFollowingUp}
              isLoading={isLoading}
              hasResult={hasResult}
              followUpEndRef={followUpEndRef}
              showComposer={false}
              inputValue={inputValue}
              onInputChange={setInputValue}
              onSend={(text) => { void handleSend(text); }}
              attachedImages={attachedImages}
              onRemoveImage={(i) => setAttachedImages(prev => prev.filter((_, j) => j !== i))}
              onAttachClick={() => fileInputRef.current?.click()}
              fileInputRef={fileInputRef}
              onFileChange={handleFileChange}
              textareaRef={textareaRef}
              onTextareaInput={autoResizeTextarea}
              headerBg={headerBg}
              cardBg={cardBg}
              cardBg2={cardBg2}
              textMain={textMain}
              textMuted={textMuted}
              textSubtle={textSubtle}
              accentInk={accentInk}
              neuExtruded={neuExtruded}
              neuExtrudedSm={neuExtrudedSm}
              isDark={isDark}
            />

            <div className="h-4" />
            </>
            )}

          </div>
        </div>

        {/* ── Floating bottom query bar ── */}
        {topTab === 'intelligence' && (
          <ChatPanel
            showEmptyState={false}
            onDemoQuery={(q) => { void handleSend(q); }}
            followUps={[]}
            followUpInput=""
            onFollowUpInputChange={() => {}}
            onFollowUp={() => {}}
            isFollowingUp={isFollowingUp}
            isLoading={isLoading}
            hasResult={false}
            followUpEndRef={followUpEndRef}
            showComposer
            inputValue={inputValue}
            onInputChange={setInputValue}
            onSend={(text) => { void handleSend(text); }}
            attachedImages={attachedImages}
            onRemoveImage={(i) => setAttachedImages(prev => prev.filter((_, j) => j !== i))}
            onAttachClick={() => fileInputRef.current?.click()}
            fileInputRef={fileInputRef}
            onFileChange={handleFileChange}
            textareaRef={textareaRef}
            onTextareaInput={autoResizeTextarea}
            headerBg={headerBg}
            cardBg={cardBg}
            cardBg2={cardBg2}
            textMain={textMain}
            textMuted={textMuted}
            textSubtle={textSubtle}
            accentInk={accentInk}
            neuExtruded={neuExtruded}
            neuExtrudedSm={neuExtrudedSm}
            isDark={isDark}
          />
        )}
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
    </div>
  );
}
