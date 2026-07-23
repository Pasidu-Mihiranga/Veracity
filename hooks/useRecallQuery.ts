'use client';

import { useQuery } from '@tanstack/react-query';
import { getUserMemory } from '@/lib/memory';

export function useRecallQuery(enabled = true) {
  return useQuery({
    queryKey: ['user-memory'],
    queryFn: getUserMemory,
    enabled,
    staleTime: 60_000,
  });
}
