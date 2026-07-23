export type ResearchJobStatus =
  | 'queued'
  | 'running'
  | 'retrying'
  | 'dead_letter'
  | 'failed'
  | 'completed'
  | 'cancelled';
