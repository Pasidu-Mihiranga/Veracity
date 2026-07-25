/** Phase 7 knowledge graph shared types */

export type KgNodeKind =
  | 'claim'
  | 'source'
  | 'competitor'
  | 'product'
  | 'decision'
  | 'event'
  | 'agent_fact';

export type KgRel =
  | 'supports'
  | 'about'
  | 'derived_from'
  | 'mentions'
  | 'decides'
  | 'timed_as'
  | 'acquired'
  | 'owns'
  | 'competes_with'
  | 'replaces'
  | 'depends_on'
  | 'launched'
  | 'targets'
  | 'uses'
  | 'invested_in'
  | 'partner_of'
  | 'same_as';

export const KG_RELS: KgRel[] = [
  'supports',
  'about',
  'derived_from',
  'mentions',
  'decides',
  'timed_as',
  'acquired',
  'owns',
  'competes_with',
  'replaces',
  'depends_on',
  'launched',
  'targets',
  'uses',
  'invested_in',
  'partner_of',
  'same_as',
];

export type Provenance = {
  createdBy?: string | null;
  sourceAgent?: string | null;
  jobId?: string | null;
  sessionId?: string | null;
  modelVersion?: string | null;
};

export type KgNodeRow = {
  id: string;
  workspace_id: string;
  kind: KgNodeKind;
  label: string;
  key: string;
  props: Record<string, unknown>;
  confidence: number;
  valid_from: string;
  valid_until: string | null;
  archived_at: string | null;
  created_by: string | null;
  source_agent: string | null;
  job_id: string | null;
  session_id: string | null;
  model_version: string | null;
  created_at: string;
  updated_at: string;
};

export type KgEdgeRow = {
  id: string;
  workspace_id: string;
  from_node_id: string;
  to_node_id: string;
  rel: KgRel;
  weight: number;
  trust: number;
  props: Record<string, unknown>;
  valid_from: string;
  valid_until: string | null;
  created_by: string | null;
  source_agent: string | null;
  job_id: string | null;
  session_id: string | null;
  model_version: string | null;
  created_at: string;
};

export type KgNodeVersionRow = {
  id: string;
  node_id: string;
  workspace_id: string;
  version: number;
  label: string;
  props: Record<string, unknown>;
  confidence_snapshot: number;
  created_at: string;
};
