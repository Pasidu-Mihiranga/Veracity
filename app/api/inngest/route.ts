import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { researchSweepFn } from '@/lib/inngest/functions/research-sweep';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [researchSweepFn],
});
