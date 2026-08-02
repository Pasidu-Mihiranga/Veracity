import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { researchSweepFn } from '@/lib/inngest/functions/research-sweep';
import { competitiveAlertsFn } from '@/lib/inngest/functions/competitive-alerts';
import { orgIntelligenceRefreshFn } from '@/lib/inngest/functions/org-intelligence-refresh';
import { researchSweepRecoveryFn } from '@/lib/inngest/functions/research-sweep-recovery';
import { projectRefreshFn } from '@/lib/inngest/functions/project-refresh';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    researchSweepFn,
    researchSweepRecoveryFn,
    competitiveAlertsFn,
    orgIntelligenceRefreshFn,
    projectRefreshFn,
  ],
});
