'use client';

import { useCallback, useMemo, useState } from 'react';
import type {
  AgentOutput,
  AgentRun,
  ExecutionPlanOutput,
  OrchestratorOutput,
  RefinementDelta,
} from '@/lib/agents/types';
import type {
  AttachedImage,
  ChatMessage,
  FollowUp,
  SessionUsage,
} from '@/types/chat-ui';
import type { Domain } from '@/lib/domain-meta';
import {
  createSession,
  saveMessage,
} from '@/lib/conversations';
import {
  indexMessageInBackground,
  recallContextForSession,
  toImageAttachments,
} from '@/lib/chat-client';
import {
  accumulateSessionUsage,
  applyAgentDomainResult,
  applyAgentUpdate,
  applyOrchestrationLog,
  applyResultToAssistant,
  historyItemFromMessage,
  mergeAgentOutputIntoFinal,
  recommendationsFromOutput,
  sourcesFromOutput,
  type ChatRequestBody,
} from '@/lib/chat-stream';
import { extractAndUpdateMemory, buildMemoryContext, type UserMemory } from '@/lib/memory';
import { buildMarketProjectContext, type MarketProject } from '@/lib/projects';
import type { ResearchTurnMode } from '@/lib/research-turn-mode';
import type { ProductViewMode } from '@/types/chat-ui';
import {
  buildChatErrorFromStreamChunk,
  buildChatErrorPayload,
  formatChatErrorForDisplay,
  orchestrationLogLineForError,
} from '@/lib/errors/chat-error';

type StreamChunkHandler = (
  body: ChatRequestBody,
  onChunk: (chunk: import('@/types/chat-ui').ChatStreamChunk) => void | Promise<void>,
) => Promise<void>;

type UseChatOrchestrationArgs = {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  followUps: FollowUp[];
  setFollowUps: React.Dispatch<React.SetStateAction<FollowUp[]>>;
  currentSessionId: string | null;
  setCurrentSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedAgentIds: Domain[];
  selectedAgents: Record<Domain, boolean>;
  forceFullSweep?: boolean;
  streamChat: StreamChunkHandler;
  userMemory: UserMemory | null;
  refreshUserMemory: () => Promise<void>;
  refreshSessions: () => Promise<unknown>;
  resetDraftInput: () => void;
  targetProject?: MarketProject | null;
  viewMode?: ProductViewMode;
  turnMode?: ResearchTurnMode;
};

const EMPTY_USAGE: SessionUsage = {
  queries: 0,
  totalCostUsd: 0,
  totalLatencyMs: 0,
  totalGeminiCalls: 0,
  totalToolCalls: 0,
};

export function useChatOrchestration({
  messages,
  setMessages,
  followUps,
  setFollowUps,
  currentSessionId,
  setCurrentSessionId,
  selectedAgentIds,
  selectedAgents,
  forceFullSweep = false,
  streamChat,
  userMemory,
  refreshUserMemory,
  refreshSessions,
  resetDraftInput,
  targetProject,
  viewMode = 'executive',
  turnMode = 'verify',
}: UseChatOrchestrationArgs) {
  const showDevErrorDetail = viewMode === 'developer';

  const applyChatFailure = useCallback((
    assistantId: number,
    payload: ReturnType<typeof buildChatErrorPayload>,
  ) => {
    const display = formatChatErrorForDisplay(payload, showDevErrorDetail);
    setMessages((prev) => prev.map((m) =>
      m.id === assistantId
        ? {
          ...m,
          content: display,
          type: 'text' as const,
          activeJobId: null,
          streamError: {
            code: payload.code,
            userMessage: payload.userMessage,
            detail: payload.detail,
            correlationId: payload.correlationId,
          },
          orchestrationLog: [
            ...(m.orchestrationLog ?? []),
            orchestrationLogLineForError(payload),
          ].slice(-48),
        }
        : m,
    ));
  }, [setMessages, showDevErrorDetail]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFollowingUp, setIsFollowingUp] = useState(false);
  const [mirofishRunning, setMirofishRunning] = useState(false);
  const [sessionUsage, setSessionUsage] = useState<SessionUsage>(EMPTY_USAGE);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [compareBaseline, setCompareBaseline] = useState<ChatMessage | null>(null);

  const handleExecutionPlanRefined = useCallback((result: {
    plan: ExecutionPlanOutput;
    orchestratorOutput?: OrchestratorOutput;
    changes?: RefinementDelta[];
  }) => {
    const { plan, orchestratorOutput, changes } = result;
    setMessages((prev) => prev.map((m) => {
      if (m.role !== 'assistant' || !m.orchestratorOutput) return m;
      const latestAssistant = [...prev].reverse().find((x) => x.role === 'assistant');
      if (m.id !== latestAssistant?.id) return m;

      const updatedOutputs = m.orchestratorOutput.outputs
        .filter((o) => o.artifactType !== 'execution-plan')
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

      const deltaLines = (changes ?? []).slice(0, 3).map((d) => `- ${d.summary}`);
      const refinedContent = updatedOutput.synthesizedAnswer || (
        deltaLines.length
          ? `${m.content}\n\nFeedback-driven updates:\n${deltaLines.join('\n')}`
          : m.content
      );

      if (currentSessionId && m.persistedId) {
        saveMessage(currentSessionId, 'assistant', refinedContent, {
          type: 'intelligence',
          orchestratorOutput: updatedOutput,
          recommendations: m.recommendations,
          sources: m.sources,
          suggestions: m.suggestions,
          agentRuns: m.agentRuns,
          refinedFrom: m.persistedId,
        }).then((newId) => {
          if (!newId) return;
          setMessages((prev2) => prev2.map((mm) =>
            mm.id === m.id ? { ...mm, persistedId: newId } : mm
          ));
        });
      }

      return { ...m, content: refinedContent, orchestratorOutput: updatedOutput };
    }));
  }, [currentSessionId, setMessages]);

  const handleSend = useCallback(async (
    text: string,
    images: AttachedImage[] = [],
    opts?: { forceFullSweep?: boolean },
  ) => {
    const effectiveText = text.trim() || (images.length > 0 ? 'Analyse the attached image(s).' : '');
    if (!effectiveText || isLoading) return;
    const sweepFull = opts?.forceFullSweep ?? forceFullSweep;
    if (selectedAgentIds.length === 0) {
      setMessages((prev) => [...prev, {
        id: Date.now(),
        role: 'assistant',
        type: 'text',
        content: 'Select at least one agent before running the query.',
      }]);
      return;
    }

    setFollowUps([]);
    const userMsg: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content: effectiveText,
      images: images.length > 0 ? images : undefined,
    };
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map(historyItemFromMessage);

    setMessages((prev) => [...prev, userMsg]);
    resetDraftInput();
    setIsLoading(true);

    // Persistence is the source of truth. Create the session and save the user
    // turn before starting an expensive research stream so a failed request or
    // closed browser cannot erase the question.
    let sessionId = currentSessionId;
    if (!sessionId) {
      const title = effectiveText.slice(0, 60) + (effectiveText.length > 60 ? '...' : '');
      const session = await createSession(title, null, targetProject?.id ?? null);
      if (!session) {
        setMessages((prev) => [...prev, {
          id: Date.now() + 1,
          role: 'assistant',
          type: 'text',
          content: 'I could not create this research conversation. Check the database connection and try again.',
        }]);
        setIsLoading(false);
        return;
      }
      sessionId = session.id;
      setCurrentSessionId(session.id);
      await refreshSessions();
    }

    const persistedUserId = await saveMessage(sessionId, 'user', effectiveText, {
      images: images.length > 0 ? images : undefined,
      turnMode,
    });
    if (!persistedUserId) {
      setMessages((prev) => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        type: 'text',
        content: 'I could not save your question, so I did not start the research run. Please try again.',
      }]);
      setIsLoading(false);
      return;
    }
    setMessages((prev) => prev.map((m) =>
      m.id === userMsg.id ? { ...m, persistedId: persistedUserId } : m,
    ));
    indexMessageInBackground(sessionId, 'user', effectiveText);

    const assistantId = Date.now() + 1;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', type: 'intelligence', content: '', agentRuns: [], orchestrationLog: [] },
    ]);

    const streamState: {
      finalOutput: OrchestratorOutput | null;
      orchestrationLog: string[];
      failureText: string;
    } = { finalOutput: null, orchestrationLog: [], failureText: '' };
    const recalledContext = await recallContextForSession(sessionId, effectiveText);
    const userMemoryContext = buildMemoryContext(userMemory);
    const projectContext = targetProject ? buildMarketProjectContext(targetProject) : '';
    const memoryContext = [projectContext, userMemoryContext, recalledContext].filter(Boolean).join('\n\n');

    try {
      await streamChat(
        {
          query: effectiveText,
          history,
          images: toImageAttachments(images),
          memoryContext,
          includeMirofish: turnMode === 'swarm' || selectedAgents.mirofish,
          includeMirofishLive: selectedAgents['mirofish-live'],
          selectedAgents: selectedAgentIds,
          followUpMode: turnMode === 'refresh' ? 'full' : 'targeted',
          forceFullSweep: turnMode === 'refresh' || sweepFull,
          turnMode,
          sessionId,
          conversationId: sessionId,
        } as ChatRequestBody & { sessionId?: string; conversationId?: string },
        (chunk) => {
          if (chunk.type === 'job_started') {
            setActiveJobId(chunk.jobId);
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? { ...m, activeJobId: chunk.jobId } : m,
            ));
            return;
          }
          if (chunk.type === 'agent_update') {
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? applyAgentUpdate(m, chunk.run, chunk.metrics) : m,
            ));
            return;
          }
          if (chunk.type === 'orchestration_log' && typeof chunk.line === 'string') {
            streamState.orchestrationLog = [...streamState.orchestrationLog, chunk.line].slice(-48);
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? applyOrchestrationLog(m, chunk.line) : m,
            ));
            return;
          }
          if (chunk.type === 'progress') {
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId
                ? { ...m, progressPct: chunk.pct }
                : m,
            ));
            return;
          }
          if (chunk.type === 'mission_summary') {
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId
                ? { ...m, missionSummary: chunk.summary }
                : m,
            ));
            return;
          }
          if (chunk.type === 'cancelled') {
            setActiveJobId(null);
            streamState.failureText = 'Sweep cancelled.';
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content || 'Sweep cancelled.', type: 'text' as const, activeJobId: null }
                : m,
            ));
            return;
          }
          if (chunk.type === 'result') {
            const out = chunk.output;
            streamState.finalOutput = out;
            setSessionUsage((prev) => accumulateSessionUsage(prev, out.metrics));
            if (selectedAgents.mirofish) setMirofishRunning(true);
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId
                ? {
                  ...applyResultToAssistant(m, out, {
                    includeMirofish: selectedAgents.mirofish,
                    includeMirofishLive: selectedAgents['mirofish-live'],
                  }),
                  activeJobId: null,
                  progressPct: 100,
                }
                : m,
            ));
            return;
          }
          if (chunk.type === 'mirofish_result') {
            const mirofishOut: AgentOutput = chunk.output;
            const run = {
              agentId: 'mirofish',
              name: 'Swarm Decision Lab',
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
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? applyAgentDomainResult(m, mirofishOut, 'mirofish', run) : m,
            ));
            return;
          }
          if (chunk.type === 'mirofish_live_result') {
            const liveOut: AgentOutput = chunk.output;
            const run = {
              agentId: 'mirofish-live',
              name: 'Swarm Decision Lab (Live)',
              status: 'completed',
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
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? applyAgentDomainResult(m, liveOut, 'mirofish-live', run) : m,
            ));
            return;
          }
          if (chunk.type === 'error') {
            setActiveJobId(null);
            const payload = buildChatErrorFromStreamChunk(chunk);
            streamState.failureText = formatChatErrorForDisplay(payload, showDevErrorDetail);
            applyChatFailure(assistantId, payload);
          }
        },
      );
    } catch (err) {
      const withPayload = err as { chatError?: ReturnType<typeof buildChatErrorPayload> };
      const payload = withPayload.chatError ?? buildChatErrorPayload(err);
      streamState.failureText = formatChatErrorForDisplay(payload, showDevErrorDetail);
      applyChatFailure(assistantId, payload);
    } finally {
      setActiveJobId(null);
      setIsLoading(false);
      setMirofishRunning(false);
    }

    const finalOutput = streamState.finalOutput;
    if (!finalOutput && !streamState.failureText) {
      streamState.failureText = 'The research run ended without producing an answer. Please retry this question.';
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, type: 'text', content: streamState.failureText } : m,
      ));
    }
    if (finalOutput) {
      const sources = sourcesFromOutput(finalOutput, 12);
      const persistedAssistantId = await saveMessage(sessionId, 'assistant', finalOutput.synthesizedAnswer, {
        type: 'intelligence',
        orchestratorOutput: finalOutput,
        recommendations: recommendationsFromOutput(finalOutput),
        sources,
        suggestions: finalOutput.suggestedFollowUps?.slice(0, 3),
        agentRuns: finalOutput.agentRuns,
        orchestrationLog: streamState.orchestrationLog,
        missionPlan: finalOutput.missionPlan,
        missionSummary: {
          steps: finalOutput.missionPlan?.steps ?? [],
          agentCount: finalOutput.missionPlan?.steps?.length ?? finalOutput.agentRuns?.length ?? 0,
        },
        quality: finalOutput.quality,
        evidenceCoverage: finalOutput.evidenceCoverage,
        selectionMeta: finalOutput.selectionMeta,
        turnMode,
      });

      if (persistedAssistantId) {
        setMessages((prev) => prev.map((m) =>
          m.id === assistantId
            ? {
              ...m,
              persistedId: persistedAssistantId,
              orchestrationLog: streamState.orchestrationLog,
            }
            : m,
        ));
      }

      indexMessageInBackground(sessionId, 'assistant', finalOutput.synthesizedAnswer);
      if (userMemory) {
        extractAndUpdateMemory(sessionId, effectiveText, finalOutput.synthesizedAnswer, userMemory)
          .then(() => refreshUserMemory())
          .catch(() => {});
      }
    } else if (streamState.failureText) {
      const persistedAssistantId = await saveMessage(sessionId, 'assistant', streamState.failureText, {
        type: 'text',
        failed: true,
        orchestrationLog: streamState.orchestrationLog,
        turnMode,
      });
      if (persistedAssistantId) {
        setMessages((prev) => prev.map((m) =>
          m.id === assistantId ? { ...m, persistedId: persistedAssistantId } : m,
        ));
      }
    }
  }, [
    currentSessionId,
    isLoading,
    messages,
    refreshSessions,
    refreshUserMemory,
    resetDraftInput,
    selectedAgentIds,
    selectedAgents,
    forceFullSweep,
    setCurrentSessionId,
    setFollowUps,
    setMessages,
    streamChat,
    targetProject,
    turnMode,
    userMemory,
    applyChatFailure,
    showDevErrorDetail,
  ]);

  const handleFollowUp = useCallback(async (text: string) => {
    if (!text.trim() || isFollowingUp || isLoading) return;
    if (!currentSessionId) {
      await handleSend(text);
      return;
    }

    const userId = Date.now();
    const assistantId = userId + 1;
    const userMessage: ChatMessage = { id: userId, role: 'user', content: text.trim() };
    setFollowUps([]);
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: 'assistant', type: 'intelligence', content: '', agentRuns: [], orchestrationLog: [] },
    ]);
    resetDraftInput();
    setIsFollowingUp(true);

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map(historyItemFromMessage);

    const persistedUserId = await saveMessage(currentSessionId, 'user', text.trim(), {
      isFollowUp: true,
      turnMode,
    });
    if (!persistedUserId) {
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId
          ? { ...m, type: 'text', content: 'I could not save this follow-up, so I did not start another research run.' }
          : m,
      ));
      setIsFollowingUp(false);
      return;
    }
    setMessages((prev) => prev.map((m) =>
      m.id === userId ? { ...m, persistedId: persistedUserId } : m,
    ));
    indexMessageInBackground(currentSessionId, 'user', text.trim());

    const recalledContext = currentSessionId ? await recallContextForSession(currentSessionId, text) : '';
    const userMemoryContext = userMemory ? buildMemoryContext(userMemory) : '';
    const projectContext = targetProject ? buildMarketProjectContext(targetProject) : '';
    const memoryContext = [projectContext, userMemoryContext, recalledContext].filter(Boolean).join('\n\n');
    const lowerFollowUp = text.toLowerCase();
    const followUpMode: 'full' | 'targeted' =
      turnMode === 'refresh' || lowerFollowUp.includes('full rerun') || lowerFollowUp.includes('full refresh')
        ? 'full'
        : 'targeted';
    const streamState: {
      finalOutput: OrchestratorOutput | null;
      orchestrationLog: string[];
      failureText: string;
    } = { finalOutput: null, orchestrationLog: [], failureText: '' };

    try {
      await streamChat(
        {
          query: text,
          history,
          memoryContext,
          followUpMode,
          includeMirofish: turnMode === 'swarm' || selectedAgents.mirofish,
          selectedAgents: selectedAgentIds,
          sessionId: currentSessionId ?? undefined,
          conversationId: currentSessionId ?? undefined,
          turnMode,
        } as ChatRequestBody & { sessionId?: string; conversationId?: string },
        (chunk) => {
          if (chunk.type === 'job_started') {
            setActiveJobId(chunk.jobId);
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? { ...m, activeJobId: chunk.jobId } : m,
            ));
            return;
          }
          if (chunk.type === 'agent_update') {
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? applyAgentUpdate(m, chunk.run, chunk.metrics) : m,
            ));
            return;
          }
          if (chunk.type === 'orchestration_log') {
            streamState.orchestrationLog = [...streamState.orchestrationLog, chunk.line].slice(-48);
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? applyOrchestrationLog(m, chunk.line) : m,
            ));
            return;
          }
          if (chunk.type === 'progress') {
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? { ...m, progressPct: chunk.pct } : m,
            ));
            return;
          }
          if (chunk.type === 'mission_summary') {
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? { ...m, missionSummary: chunk.summary } : m,
            ));
            return;
          }
          if (chunk.type === 'cancelled') {
            streamState.failureText = 'Research cancelled.';
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId
                ? { ...m, type: 'text', content: 'Research cancelled.', activeJobId: null }
                : m,
            ));
            return;
          }
          if (chunk.type === 'error') {
            const payload = buildChatErrorFromStreamChunk(chunk);
            streamState.failureText = formatChatErrorForDisplay(payload, showDevErrorDetail);
            applyChatFailure(assistantId, payload);
            return;
          }
          if (chunk.type !== 'result') return;
          const out = chunk.output;
          streamState.finalOutput = out;
          setSessionUsage((prev) => accumulateSessionUsage(prev, out.metrics));
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId
              ? { ...applyResultToAssistant(m, out, { includeMirofish: false, includeMirofishLive: false }), progressPct: 100 }
              : m,
          ));
        },
      );

      const out = streamState.finalOutput;
      if (!out && !streamState.failureText) {
        streamState.failureText = 'The follow-up research ended without producing an answer. Please retry.';
        setMessages((prev) => prev.map((m) =>
          m.id === assistantId ? { ...m, type: 'text', content: streamState.failureText } : m,
        ));
      }
      if (out) {
        const sources = sourcesFromOutput(out, 12);
        const persistedAssistantId = await saveMessage(currentSessionId, 'assistant', out.synthesizedAnswer, {
          isFollowUp: true,
          type: 'intelligence',
          orchestratorOutput: out,
          recommendations: recommendationsFromOutput(out),
          sources,
          suggestions: out?.suggestedFollowUps?.slice(0, 3),
          agentRuns: out.agentRuns,
          orchestrationLog: streamState.orchestrationLog,
          missionPlan: out?.missionPlan,
          quality: out?.quality,
          evidenceCoverage: out?.evidenceCoverage,
          selectionMeta: out?.selectionMeta,
          turnMode,
        });
        if (persistedAssistantId) {
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, persistedId: persistedAssistantId } : m,
          ));
        }
        indexMessageInBackground(currentSessionId, 'assistant', out.synthesizedAnswer);
        if (userMemory) {
          extractAndUpdateMemory(currentSessionId, text, out.synthesizedAnswer, userMemory)
            .then(() => refreshUserMemory())
            .catch(() => {});
        }
      } else if (streamState.failureText) {
        const persistedAssistantId = await saveMessage(currentSessionId, 'assistant', streamState.failureText, {
          isFollowUp: true,
          type: 'text',
          failed: true,
          orchestrationLog: streamState.orchestrationLog,
          turnMode,
        });
        if (persistedAssistantId) {
          setMessages((prev) => prev.map((m) =>
            m.id === assistantId ? { ...m, persistedId: persistedAssistantId } : m,
          ));
        }
      }
    } catch (err) {
      const withPayload = err as { chatError?: ReturnType<typeof buildChatErrorPayload> };
      const payload = withPayload.chatError ?? buildChatErrorPayload(err);
      applyChatFailure(assistantId, payload);
      const display = formatChatErrorForDisplay(payload, showDevErrorDetail);
      const persistedAssistantId = await saveMessage(currentSessionId, 'assistant', display, {
        isFollowUp: true,
        type: 'text',
        failed: true,
        turnMode,
      });
      if (persistedAssistantId) {
        setMessages((prev) => prev.map((m) =>
          m.id === assistantId ? { ...m, persistedId: persistedAssistantId } : m,
        ));
      }
    } finally {
      setActiveJobId(null);
      setIsFollowingUp(false);
    }
  }, [
    currentSessionId,
    handleSend,
    isFollowingUp,
    isLoading,
    messages,
    refreshUserMemory,
    resetDraftInput,
    selectedAgentIds,
    selectedAgents,
    setFollowUps,
    setMessages,
    streamChat,
    targetProject,
    turnMode,
    userMemory,
    showDevErrorDetail,
    applyChatFailure,
  ]);

  const handleComposerSend = useCallback((text: string, hasResult: boolean, images: AttachedImage[]) => {
    if (hasResult) {
      void handleFollowUp(text);
      return;
    }
    void handleSend(text, images);
  }, [handleFollowUp, handleSend]);

  const cancelActiveJob = useCallback(async () => {
    if (!activeJobId) return;
    try {
      await fetch(`/api/jobs/${activeJobId}/cancel`, { method: 'POST' });
    } catch {
      // ignore; job stream will surface status
    }
  }, [activeJobId]);

  const requestFullSweepCompare = useCallback(() => {
    const latest = [...messages].reverse().find((m) => m.role === 'assistant' && m.orchestratorOutput);
    if (!latest) return;
    setCompareBaseline(latest);
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser?.content) return;
    void handleSend(lastUser.content, lastUser.images ?? [], { forceFullSweep: true });
  }, [handleSend, messages]);

  const resetSessionUsage = useCallback(() => setSessionUsage(EMPTY_USAGE), []);

  return useMemo(() => ({
    isLoading,
    isFollowingUp,
    mirofishRunning,
    sessionUsage,
    setSessionUsage,
    activeJobId,
    compareBaseline,
    handleSend,
    handleFollowUp,
    handleComposerSend,
    handleExecutionPlanRefined,
    resetSessionUsage,
    cancelActiveJob,
    requestFullSweepCompare,
    clearCompareBaseline: () => setCompareBaseline(null),
  }), [
    activeJobId,
    cancelActiveJob,
    compareBaseline,
    handleComposerSend,
    handleExecutionPlanRefined,
    handleFollowUp,
    handleSend,
    isFollowingUp,
    isLoading,
    mirofishRunning,
    requestFullSweepCompare,
    resetSessionUsage,
    sessionUsage,
  ]);
}
