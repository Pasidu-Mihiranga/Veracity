'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteSession,
  listSessions,
  loadMessages,
  type ChatSession,
} from '@/lib/conversations';
import { hydrateMessage } from '@/lib/chat-client';
import type { ChatMessage, FollowUp } from '@/types/chat-ui';

function splitStoredMessages(messages: Awaited<ReturnType<typeof loadMessages>>) {
  const mainMessages: ChatMessage[] = [];
  const loadedFollowUps: FollowUp[] = [];

  messages.forEach((m, i) => {
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

  return { mainMessages, loadedFollowUps };
}

export function useDashboardSessions() {
  const queryClient = useQueryClient();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loadingSessionMessages, setLoadingSessionMessages] = useState(false);
  const [queryCacheStats, setQueryCacheStats] = useState({ hits: 0, misses: 0 });

  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: listSessions,
    // IMPORTANT: do NOT use initialData: [] with global staleTime — empty [] is
    // treated as fresh cache and the sidebar never refetches (shows 0 forever).
    placeholderData: [] as ChatSession[],
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const sessions = sessionsQuery.data ?? [];
  const loadingSessions =
    (sessionsQuery.isLoading || sessionsQuery.isFetching) && sessions.length === 0
    || loadingSessionMessages;

  const refreshSessions = useCallback(async () => {
    const result = await queryClient.fetchQuery({
      queryKey: ['sessions'],
      queryFn: listSessions,
      staleTime: 0,
    });
    return result;
  }, [queryClient]);

  const loadSessionById = useCallback(
    async (sessionId: string) => {
      setLoadingSessionMessages(true);
      setCurrentSessionId(sessionId);
      const hadCachedMessages = Boolean(queryClient.getQueryData(['sessionMessages', sessionId]));
      setQueryCacheStats((prev) => ({
        hits: prev.hits + (hadCachedMessages ? 1 : 0),
        misses: prev.misses + (hadCachedMessages ? 0 : 1),
      }));
      try {
        const stored = await queryClient.fetchQuery({
          queryKey: ['sessionMessages', sessionId],
          queryFn: () => loadMessages(sessionId),
          staleTime: 0,
        });
        const { mainMessages, loadedFollowUps } = splitStoredMessages(stored);
        setMessages(mainMessages);
        setFollowUps(loadedFollowUps);
      } finally {
        setLoadingSessionMessages(false);
      }
    },
    [queryClient],
  );

  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: async (_, sessionId) => {
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
        setFollowUps([]);
      }
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.removeQueries({ queryKey: ['sessionMessages', sessionId] });
    },
  });

  const resetConversation = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    setFollowUps([]);
  }, []);

  return {
    sessions,
    loadingSessions,
    currentSessionId,
    setCurrentSessionId,
    messages,
    setMessages,
    followUps,
    setFollowUps,
    refreshSessions,
    loadSession: loadSessionById,
    deleteSession: async (sessionId: string) => {
      await deleteMutation.mutateAsync(sessionId);
    },
    resetConversation,
    queryCacheStats,
  };
}
