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
  isMirofishLiveFailed,
  mergeAgentOutputIntoFinal,
  recommendationsFromOutput,
  sourcesFromOutput,
  type ChatRequestBody,
} from '@/lib/chat-stream';
import { extractAndUpdateMemory, buildMemoryContext, type UserMemory } from '@/lib/memory';

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
}: UseChatOrchestrationArgs) {
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
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    resetDraftInput();
    setIsLoading(true);

    const assistantId = Date.now() + 1;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', type: 'intelligence', content: '', agentRuns: [], orchestrationLog: [] },
    ]);

    const streamState: {
      finalOutput: OrchestratorOutput | null;
      orchestrationLog: string[];
    } = { finalOutput: null, orchestrationLog: [] };
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
          images: toImageAttachments(images),
          memoryContext,
          includeMirofish: selectedAgents.mirofish,
          includeMirofishLive: selectedAgents['mirofish-live'],
          selectedAgents: selectedAgentIds,
          forceFullSweep: sweepFull,
          sessionId: currentSessionId ?? undefined,
          conversationId: currentSessionId ?? undefined,
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
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? applyAgentDomainResult(m, mirofishOut, 'mirofish', run) : m,
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
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? applyAgentDomainResult(m, liveOut, 'mirofish-live', run) : m,
            ));
            return;
          }
          if (chunk.type === 'error') {
            setActiveJobId(null);
            setMessages((prev) => prev.map((m) =>
              m.id === assistantId ? { ...m, content: `Analysis failed: ${chunk.message}`, type: 'text', activeJobId: null } : m,
            ));
          }
        },
      );
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Failed to connect. Please try again.';
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, content: message } : m,
      ));
    } finally {
      setActiveJobId(null);
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
          orchestrationLog: streamState.orchestrationLog,
          missionPlan: finalOutput.missionPlan,
          missionSummary: {
            steps: finalOutput.missionPlan?.steps ?? [],
            agentCount: finalOutput.missionPlan?.steps?.length ?? finalOutput.agentRuns?.length ?? 0,
          },
          quality: finalOutput.quality,
          evidenceCoverage: finalOutput.evidenceCoverage,
          selectionMeta: finalOutput.selectionMeta,
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
    userMemory,
  ]);

  const handleFollowUp = useCallback(async (text: string) => {
    if (!text.trim() || isFollowingUp || isLoading) return;
    const fuId = Date.now();
    setFollowUps((prev) => [...prev, { id: fuId, question: text, answer: '', loading: true }]);
    resetDraftInput();
    setIsFollowingUp(true);

    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    for (const fu of followUps) {
      if (fu.question) history.push({ role: 'user', content: fu.question });
      if (fu.answer && !fu.loading) history.push({ role: 'assistant', content: fu.answer });
    }

    const recalledContext = currentSessionId ? await recallContextForSession(currentSessionId, text) : '';
    const userMemoryContext = userMemory ? buildMemoryContext(userMemory) : '';
    const memoryContext = [userMemoryContext, recalledContext].filter(Boolean).join('\n\n');
    const lowerFollowUp = text.toLowerCase();
    const followUpMode: 'full' | 'targeted' =
      lowerFollowUp.includes('full rerun') || lowerFollowUp.includes('full refresh')
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
          sessionId: currentSessionId ?? undefined,
          conversationId: currentSessionId ?? undefined,
        } as ChatRequestBody & { sessionId?: string; conversationId?: string },
        async (chunk) => {
          if (chunk.type !== 'result') return;
          const out = chunk.output;
          setSessionUsage((prev) => accumulateSessionUsage(prev, out.metrics));
          const sources = sourcesFromOutput(out, 6);
          setFollowUps((prev) => prev.map((f) =>
            f.id === fuId ? { ...f, answer: out.synthesizedAnswer, sources, loading: false } : f,
          ));

          if (currentSessionId) {
            await saveMessage(currentSessionId, 'user', text, { isFollowUp: true });
            await saveMessage(currentSessionId, 'assistant', out.synthesizedAnswer, { isFollowUp: true, sources });
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
      setFollowUps((prev) => prev.map((f) =>
        f.id === fuId ? { ...f, answer: 'Follow-up failed. Please try again.', loading: false } : f,
      ));
    } finally {
      setIsFollowingUp(false);
    }
  }, [
    currentSessionId,
    followUps,
    isFollowingUp,
    isLoading,
    messages,
    refreshUserMemory,
    resetDraftInput,
    selectedAgentIds,
    selectedAgents,
    setFollowUps,
    streamChat,
    userMemory,
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
