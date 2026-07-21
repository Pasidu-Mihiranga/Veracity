'use client';

import { useCallback } from 'react';
import {
  streamChatRequest,
  type ChatRequestBody,
  type StreamChatOptions,
} from '@/lib/chat-stream';
import type { ChatStreamChunk } from '@/types/chat-ui';

/**
 * Thin React wrapper around the chat SSE transport.
 * Keeps fetch + event parsing out of page.tsx while leaving message state
 * ownership with the caller (via onChunk).
 */
export function useChatStream() {
  const streamChat = useCallback(
    async (
      body: ChatRequestBody,
      onChunk: (chunk: ChatStreamChunk) => void | Promise<void>,
      options?: StreamChatOptions,
    ) => {
      await streamChatRequest(body, onChunk, options);
    },
    [],
  );

  return { streamChat };
}
