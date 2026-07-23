import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { researchSweepFn } from '@/lib/inngest/functions/research-sweep';
import { competitiveAlertsFn } from '@/lib/inngest/functions/competitive-alerts';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [researchSweepFn, competitiveAlertsFn],
});
