'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send, Plus, Search, ChevronRight, ChevronLeft, RefreshCw, ArrowUpRight,
  LogOut, User, Layers, X, History, GitBranch, PanelLeftClose, PanelLeft,
  TrendingUp, Swords, Trophy, DollarSign, Megaphone, Telescope,
  CheckCircle2, Check, Circle, AlertCircle, MessageSquarePlus, Paperclip, Trash2,
  Activity, Zap, Shield, Sun, Moon, Rocket, Fish, CheckCheck, Sparkles,
  ThumbsUp, ThumbsDown, BarChart3, Crosshair,
} from 'lucide-react';
import { ApiUsagePanel } from '@/components/ApiUsagePanel';
import { StealStrategyPanel } from '@/components/StealStrategyPanel';
import { createClient } from '@/lib/supabase-browser';
import type { AgentRun, OrchestratorOutput, AgentOutput, ImageAttachment, MindMapOutput, ExecutionPlanOutput, ForecastOutput, RefinementDelta } from '@/lib/agents/types';
import { ArtifactRenderer } from '@/components/artifacts/ArtifactRenderer';
import { useTheme } from '@/lib/theme-provider';
import {
  createSession, listSessions, saveMessage, loadMessages, deleteSession, type ChatSession, type StoredMessage,
} from '@/lib/conversations';
import {
  getUserMemory, extractAndUpdateMemory, buildMemoryContext, type UserMemory,
} from '@/lib/memory';
import {
  rateRecommendation, recommendationKey, type RecommendationRating,
} from '@/lib/feedback';
import { filterDisplaySources } from '@/lib/tools/source-validator';

// Per-session pgvector recall (semantic search over earlier turns in this chat)
async function recallContextForSession(sessionId: string, query: string): Promise<string> {
  try {
    const res = await fetch('/api/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, query }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return (data?.context as string) ?? '';
  } catch { return ''; }
}

function indexMessageInBackground(sessionId: string, role: 'user' | 'assistant', content: string) {
  if (!content?.trim()) return;
  fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, role, content }),
  }).catch(() => {});
}

/* ─── Types ─────────────────────────────────────────────── */
type SourceLink   = { title: string; url: string };
type AttachedImage = { dataUrl: string; data: string; mimeType: string; name: string };
type LiveRunMetrics = {
  elapsedMs: number;
  agentCount: number;
  completedAgentCount: number;
  failedAgentCount: number;
  runningAgentCount: number;
  estimatedCostUsd: number;
  geminiCallCount: number;
  toolCallCount: number;
};
type Message = {
  id: number;
  // Supabase row id of the persisted chat_messages row. Required for the
  // feedback/refine loop: /api/refine needs the authoritative messageId to
  // look up the prior orchestratorOutput and re-run full orchestration.
  persistedId?: string | null;
  role: 'user' | 'assistant';
  type?: 'text' | 'intelligence';
  content: string;
  images?: AttachedImage[];
  sources?: SourceLink[];
  suggestions?: string[];
  recommendations?: any[];
  agentRuns?: AgentRun[];
  orchestratorOutput?: OrchestratorOutput;
  liveMetrics?: LiveRunMetrics;
  /** Live backend status lines while the chat stream is open (not persisted). */
  orchestrationLog?: string[];
};
type FollowUp = {
  id: number;
  question: string;
  answer: string;
  sources?: SourceLink[];
  loading?: boolean;
};

type PipelineStageState = 'pending' | 'running' | 'completed' | 'failed';
type PipelineStage = {
  id: string;
  label: string;
  state: PipelineStageState;
};

/* ─── Constants ─────────────────────────────────────────── */
const DEMO_QUERIES = [
  'Is Lilian competitive in the AI SDR market right now?',
  'Is the digital workers category accelerating or consolidating?',
  'What should Vector Agents build to capture emerging demand?',
];

const ALL_DOMAINS = ['market-trends', 'competitive', 'win-loss', 'pricing', 'positioning', 'adjacent', 'execution-engine', 'mirofish', 'mirofish-live'] as const;
type Domain = typeof ALL_DOMAINS[number];

const DOMAIN_META: Record<Domain, {
  label: string; short: string;
  icon: React.ReactNode;
  color: string;       // dark-mode text/icon
  colorLight: string;  // light-mode text/icon (higher contrast)
  bg: string;
  bgLight: string;
  border: string;
}> = {
  'market-trends': {
    label: 'Market & Trend Sensing',   short: 'Market Trends',
    icon: <TrendingUp size={14} />,
    color: '#00C4FF', colorLight: '#0052A3',
    bg: 'rgba(0,196,255,0.12)', bgLight: 'rgba(0,82,163,0.1)', border: 'rgba(0,82,163,0.35)',
  },
  'competitive': {
    label: 'Competitive Landscape',    short: 'Competitive',
    icon: <Swords size={14} />,
    color: '#3D9EFF', colorLight: '#1A5A9A',
    bg: 'rgba(61,158,255,0.12)', bgLight: 'rgba(26,90,154,0.1)', border: 'rgba(26,90,154,0.35)',
  },
  'win-loss': {
    label: 'Win / Loss Intelligence',  short: 'Win / Loss',
    icon: <Trophy size={14} />,
    color: '#7EC8FF', colorLight: '#0B4F8C',
    bg: 'rgba(126,200,255,0.12)', bgLight: 'rgba(11,79,140,0.1)', border: 'rgba(11,79,140,0.35)',
  },
  'pricing': {
    label: 'Pricing & Packaging',      short: 'Pricing',
    icon: <DollarSign size={14} />,
    color: '#2A7FD4', colorLight: '#0B4F8C',
    bg: 'rgba(42,127,212,0.12)', bgLight: 'rgba(11,79,140,0.1)', border: 'rgba(11,79,140,0.35)',
  },
  'positioning': {
    label: 'Positioning & Messaging',  short: 'Positioning',
    icon: <Megaphone size={14} />,
    color: '#1A5A9A', colorLight: '#063A6B',
    bg: 'rgba(26,90,154,0.12)', bgLight: 'rgba(6,58,107,0.1)', border: 'rgba(6,58,107,0.35)',
  },
  'adjacent': {
    label: 'Adjacent Market Collision', short: 'Adjacent',
    icon: <Telescope size={14} />,
    color: '#5AB0E8', colorLight: '#1A5A9A',
    bg: 'rgba(90,176,232,0.12)', bgLight: 'rgba(26,90,154,0.1)', border: 'rgba(26,90,154,0.35)',
  },
  'execution-engine': {
    label: 'Execution Engine',          short: 'Execution',
    icon: <Rocket size={14} />,
    color: '#00C4FF', colorLight: '#0052A3',
    bg: 'rgba(0,196,255,0.12)', bgLight: 'rgba(0,82,163,0.1)', border: 'rgba(0,82,163,0.35)',
  },
  'mirofish': {
    label: 'MiroFish (Forecast)',        short: 'MiroFish',
    icon: <Fish size={14} />,
    color: '#9ED8FF', colorLight: '#0B4F8C',
    bg: 'rgba(158,216,255,0.14)', bgLight: 'rgba(11,79,140,0.1)', border: 'rgba(11,79,140,0.4)',
  },
  'mirofish-live': {
    label: 'MiroFish Live (Real VPS)',   short: 'MiroFish Live',
    icon: <Fish size={14} />,
    color: '#1A5A9A', colorLight: '#063A6B',
    bg: 'rgba(0,196,255,0.1)', bgLight: 'rgba(6,58,107,0.1)', border: 'rgba(6,58,107,0.3)',
  },
};

function domainAccent(meta: { color: string; colorLight: string }, isDark: boolean) {
  return isDark ? meta.color : meta.colorLight;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function hydrateMessage(m: StoredMessage, idx: number): Message {
  const meta = m.metadata ?? {};
  return {
    id: idx,
    persistedId: m.id,
    role: m.role,
    type: (meta.type as Message['type']) ?? (m.role === 'assistant' ? 'intelligence' : undefined),
    content: m.content,
    images: meta.images as AttachedImage[] | undefined,
    sources: meta.sources as SourceLink[] | undefined,
    suggestions: meta.suggestions as string[] | undefined,
    recommendations: meta.recommendations as any[] | undefined,
    agentRuns: meta.agentRuns as AgentRun[] | undefined,
    orchestratorOutput: meta.orchestratorOutput as OrchestratorOutput | undefined,
  };
}

/* ─── Confidence badge ───────────────────────────────────── */
function ConfidenceBadge({ level }: { level?: string }) {
  const { isDark } = useTheme();
  if (!level) return null;
  const styles: Record<string, { color: string; bg: string; border: string }> = isDark
    ? {
        high:   { color: '#00C4FF', bg: 'rgba(0,196,255,0.12)',  border: 'rgba(0,196,255,0.3)'  },
        medium: { color: '#3D9EFF', bg: 'rgba(61,158,255,0.12)',  border: 'rgba(61,158,255,0.3)'  },
        low:    { color: '#6B849C', bg: 'rgba(107,132,156,0.12)', border: 'rgba(107,132,156,0.25)' },
      }
    : {
        high:   { color: '#0052A3', bg: 'rgba(0,82,163,0.1)',  border: 'rgba(0,82,163,0.28)'  },
        medium: { color: '#1A5A9A', bg: 'rgba(26,90,154,0.1)',  border: 'rgba(26,90,154,0.28)'  },
        low:    { color: '#2E4F72', bg: 'rgba(46,79,114,0.1)', border: 'rgba(46,79,114,0.25)' },
      };
  const s = styles[level] ?? styles.low;
  return (
    <span className="neu-pill text-[10px] font-mono font-medium uppercase tracking-wide px-2.5 py-0.5"
      style={{ color: s.color, background: s.bg }}>
      {level}
    </span>
  );
}

function buildSourceMix(outputs: AgentOutput[] = []) {
  const counts = new Map<string, number>();
  for (const output of outputs) {
    for (const source of output.sources ?? []) {
      counts.set(source.tool, (counts.get(source.tool) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tool, count]) => ({ tool, count }));
}

/* ─── Sidebar agent row ──────────────────────────────────── */
function SidebarAgentRow({
  domain,
  run,
  selected,
  onToggle,
}: {
  domain: Domain;
  run?: AgentRun;
  selected: boolean;
  onToggle: () => void;
}) {
  const { isDark, textMuted, textSubtle } = useTheme();
  const meta   = DOMAIN_META[domain];
  const accent = domainAccent(meta, isDark);
  const status = run?.status ?? 'idle';

  return (
    <div className="agent-row-enhanced flex items-center gap-2.5"
      style={{ background: selected ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)') : 'transparent' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${selected ? 'Disable' : 'Enable'} ${meta.short}`}
        className="w-4 h-4 rounded shrink-0 flex items-center justify-center transition-all"
        style={{
          background: selected ? accent : 'var(--background)',
          boxShadow: selected
            ? `inset 2px 2px 4px rgba(0,0,0,0.2), 0 0 6px ${accent}44`
            : 'var(--shadow-extruded-sm)',
          border: 'none',
        }}
      >
        {selected && <Check size={10} color="#fff" strokeWidth={3} />}
      </button>
      <div className="w-4 shrink-0 flex justify-center">
        {status === 'running'   && <RefreshCw size={12} style={{ color: accent }} className="animate-spin" />}
        {status === 'completed' && <CheckCircle2 size={12} style={{ color: 'var(--status-ok)' }} />}
        {status === 'failed'    && <AlertCircle size={12} style={{ color: 'var(--status-fail)' }} />}
        {(status === 'idle' || status === 'pending') && <Circle size={12} style={{ color: 'var(--foreground-subtle)' }} />}
      </div>
      <span className="text-[13px] flex-1 truncate" style={{
        textDecoration: selected ? 'none' : 'line-through',
        color: status === 'running'   ? accent :
               status === 'completed' ? undefined :
               status === 'failed'    ? 'var(--status-fail)' : textSubtle,
        fontWeight: status === 'running' ? 600 : selected ? 500 : 400,
        letterSpacing: '-0.01em',
      }}>
        {meta.short}
        {domain === 'mirofish-live' && status === 'idle' && (
          <span className="ml-1.5 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 neu-pill-positive">
            VPS
          </span>
        )}
      </span>
      {status === 'running' && (
        <span className="neu-pill-accent text-[9px] font-mono font-semibold px-1.5 py-0.5"
          style={{ color: accent }}>
          live
        </span>
      )}
      {status === 'completed' && (run as any)?.confidence && (
        <ConfidenceBadge level={(run as any).confidence} />
      )}
    </div>
  );
}

/* ─── Agent card ─────────────────────────────────────────── */
function AgentCard({
  domain, run, output, isExpanded, onClick,
}: {
  domain: Domain; run?: AgentRun; output?: AgentOutput;
  isExpanded: boolean; onClick: () => void;
}) {
  const { isDark, surface, textMuted, textSubtle } = useTheme();
  const meta      = DOMAIN_META[domain];
  const accent    = domainAccent(meta, isDark);
  const status    = run?.status ?? 'idle';
  const snippet   = output?.facts?.[0] ?? output?.interpretation?.[0];
  const clickable = !!output;

  const bgTint = (status === 'running' || status === 'completed')
    ? (isDark ? meta.bg : meta.bgLight)
    : 'transparent';

  return (
    <button
      onClick={onClick}
      disabled={!clickable && status !== 'running'}
      className="relative flex flex-col gap-3 p-4 rounded-[20px] text-left transition-all duration-300"
      style={{
        background: 'var(--background)',
        border: 'none',
        boxShadow: isExpanded
          ? `var(--shadow-inset), 0 0 0 2px ${accent}44`
          : status === 'running'
            ? `var(--shadow-extruded-sm), 0 0 0 1px ${accent}33`
            : 'var(--shadow-extruded)',
        cursor: clickable ? 'pointer' : 'default',
        opacity: status === 'idle' ? 0.65 : 1,
      }}
    >
      {/* Colour wash */}
      {(status === 'running' || (status === 'completed' && isExpanded)) && (
        <div className="absolute inset-0 rounded-[20px] pointer-events-none" style={{ background: bgTint }} />
      )}

      {/* Header */}
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color: status === 'idle' ? 'var(--foreground-subtle)' : accent }}>{meta.icon}</span>
          <span className="text-[11px] font-mono font-semibold uppercase tracking-widest truncate"
            style={{ color: status === 'idle' ? 'var(--foreground-subtle)' : accent }}>
            {meta.short}
          </span>
        </div>

        {status === 'idle' && (
          <span className="neu-pill text-[9px] font-mono px-2 py-0.5" style={{ color: 'var(--foreground-subtle)' }}>idle</span>
        )}
        {status === 'pending' && (
          <span className="neu-pill text-[9px] font-mono px-2 py-0.5 flex items-center gap-1"
            style={{ color: 'var(--muted-foreground)' }}>
            queued <RefreshCw size={7} className="animate-spin" />
          </span>
        )}
        {status === 'running' && (
          <span className="neu-pill-accent text-[9px] font-mono px-2 py-0.5 flex items-center gap-1 font-medium"
            style={{ color: accent }}>
            live <RefreshCw size={7} className="animate-spin" />
          </span>
        )}
        {status === 'completed' && output?.confidence && (
          <ConfidenceBadge level={output.confidence} />
        )}
        {status === 'failed' && (
          <span className="neu-pill-negative text-[9px] font-mono px-2 py-0.5">failed</span>
        )}
      </div>

      {/* Body */}
      <div className="relative flex-1 min-h-[52px]">
        {status === 'idle' && (
          <p className="text-xs font-mono" style={{ color: 'var(--foreground-subtle)' }}>awaiting query…</p>
        )}
        {status === 'pending' && (
          <div className="flex flex-col gap-2 opacity-50">
            <div className="h-2.5 rounded skeleton w-4/5" />
            <div className="h-2.5 rounded skeleton w-3/5" />
          </div>
        )}
        {status === 'running' && (
          <div className="flex flex-col gap-2">
            <div className="h-2.5 rounded skeleton w-full" />
            <div className="h-2.5 rounded skeleton w-4/5" style={{ animationDelay: '0.2s' }} />
            <div className="h-2.5 rounded skeleton w-3/5" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
        {status === 'completed' && snippet && (
          <p className="agent-snippet line-clamp-3">{snippet}</p>
        )}
        {status === 'failed' && (
          <p className="text-xs" style={{ color: '#0B1A2E' }}>Agent failed — partial data only.</p>
        )}
      </div>

      {/* Footer */}
      {output?.sources && output.sources.length > 0 && (
        <div className="relative flex items-center gap-1.5 pt-2.5">
          <span className="text-[10px] font-mono" style={{ color: 'var(--foreground-subtle)' }}>
            {output.sources.length} sources
          </span>
          <ChevronRight size={10} className="ml-auto transition-transform duration-150"
            style={{ color: accent, transform: isExpanded ? 'rotate(90deg)' : 'none' }} />
        </div>
      )}
    </button>
  );
}

/* ─── Main dashboard ─────────────────────────────────────── */
export default function VeracityDashboard() {
  const router   = useRouter();
  const supabase = createClient();
  const { isDark, toggle: toggleTheme, surface, surface2, text, textMuted, textSubtle } = useTheme();
  const [messages, setMessages]           = useState<Message[]>([]);
  const [inputValue, setInputValue]       = useState('');
  const [isLoading, setIsLoading]         = useState(false);
  const [userEmail, setUserEmail]         = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu]   = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<Domain | null>(null);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [followUps, setFollowUps]         = useState<FollowUp[]>([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [isFollowingUp, setIsFollowingUp] = useState(false);
  // Track which recommendations the user has rated (key → rating)
  const [ratedRecs, setRatedRecs] = useState<Record<string, RecommendationRating>>({});
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [userMemory, setUserMemory] = useState<UserMemory | null>(null);
  const [mirofishRunning, setMirofishRunning] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<Record<Domain, boolean>>(() =>
    Object.fromEntries(ALL_DOMAINS.map(d => [d, d !== 'mirofish-live'])) as Record<Domain, boolean>
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  /** Top header tabs: main intelligence vs usage vs steal strategy. */
  const [topTab, setTopTab] = useState<'intelligence' | 'usage' | 'steal'>('intelligence');
  const [headerCompact, setHeaderCompact] = useState(false);
  /** Rolling totals for API Usage tab (reset on new query). */
  const [sessionUsage, setSessionUsage] = useState({
    queries: 0,
    totalCostUsd: 0,
    totalLatencyMs: 0,
    totalGeminiCalls: 0,
    totalToolCalls: 0,
  });

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const followUpEndRef  = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const mainScrollRef   = useRef<HTMLDivElement>(null);
  const headerIslandRef = useRef<HTMLElement>(null);
  const headerCompress  = useRef(0);
  const headerTarget    = useRef(0);
  const headerRaf       = useRef(0);

  const autoResizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, []);

  // Keep the textarea height in sync when value is cleared programmatically
  // (e.g. after sending a long query).
  useEffect(() => {
    autoResizeTextarea();
  }, [inputValue, autoResizeTextarea]);

  const tickHeaderCompress = useCallback(() => {
    headerRaf.current = 0;
    const island = headerIslandRef.current;
    if (!island) return;

    const next = headerCompress.current + (headerTarget.current - headerCompress.current) * 0.14;
    headerCompress.current = Math.abs(headerTarget.current - next) < 0.001
      ? headerTarget.current
      : next;

    const t = headerCompress.current;
    island.style.setProperty('--hc', t.toFixed(4));
    const compact = t > 0.58;
    island.classList.toggle('header-island--compact', compact);
    setHeaderCompact(prev => (prev === compact ? prev : compact));

    if (headerCompress.current !== headerTarget.current) {
      headerRaf.current = requestAnimationFrame(tickHeaderCompress);
    }
  }, []);

  const onMainScroll = useCallback(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    // Map ~0–96px scroll into 0–1 with a soft ease-in curve
    const raw = Math.min(1, Math.max(0, el.scrollTop / 96));
    headerTarget.current = raw * raw * (3 - 2 * raw); // smoothstep
    if (!headerRaf.current) {
      headerRaf.current = requestAnimationFrame(tickHeaderCompress);
    }
  }, [tickHeaderCompress]);

  useEffect(() => () => {
    if (headerRaf.current) cancelAnimationFrame(headerRaf.current);
  }, []);

  // React's style={{ background }} can wipe --hc; restore after paint.
  useLayoutEffect(() => {
    const island = headerIslandRef.current;
    if (!island) return;
    island.style.setProperty('--hc', headerCompress.current.toFixed(4));
  });

  const allSelected = ALL_DOMAINS.every(d => selectedAgents[d]);

  const currentResult  = [...messages].reverse().find(m => m.role === 'assistant');
  const recentQueries  = messages.filter(m => m.role === 'user').map(m => m.content);
  const hasResult      = !!(currentResult?.orchestratorOutput);
  const completedCount = currentResult?.agentRuns?.filter(r => r.status === 'completed').length ?? 0;
  const totalCount     = currentResult?.agentRuns?.length ?? 0;
  const selectedAgentIds = ALL_DOMAINS.filter(d => selectedAgents[d]);
  const orchLogLen     = currentResult?.orchestrationLog?.length ?? 0;
  const orchestrationLines = currentResult?.orchestrationLog ?? [];

  const refreshSessions = useCallback(async () => {
    setLoadingSessions(true);
    const s = await listSessions();
    setSessions(s);
    setLoadingSessions(false);
    return s;
  }, []);

  const loadSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setExpandedDomain(null);
    setFollowUps([]);
    const stored = await loadMessages(sessionId);
    
    // Separate main messages from follow-ups based on metadata
    const mainMessages: Message[] = [];
    const loadedFollowUps: FollowUp[] = [];
    
    stored.forEach((m, i) => {
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
    
    setMessages(mainMessages);
    setFollowUps(loadedFollowUps);
  }, []);

  const refreshUserMemory = useCallback(async () => {
    try {
      const m = await getUserMemory();
      setUserMemory(m);
    } catch {
      // Non-fatal — chat still works without persistent memory
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    refreshSessions();
    refreshUserMemory();
  }, [refreshSessions, refreshUserMemory]);

  useEffect(() => {
    if (followUps.length > 0) followUpEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [followUps]);

  useEffect(() => {
    if (!currentResult?.orchestratorOutput) return;
    if (expandedDomain && getOutputForDomain(expandedDomain)) return;
    const firstAvailable = ALL_DOMAINS.find(d => !!getOutputForDomain(d));
    if (firstAvailable) setExpandedDomain(firstAvailable);
  }, [currentResult?.orchestratorOutput, expandedDomain]);

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/auth'); router.refresh(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const imgs: AttachedImage[] = await Promise.all(files.map(async file => {
      const dataUrl = await readFileAsBase64(file);
      const [prefix, data] = dataUrl.split(',');
      const mimeType = prefix.split(':')[1].split(';')[0];
      return { dataUrl, data, mimeType, name: file.name };
    }));
    setAttachedImages(prev => [...prev, ...imgs]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Swap a refined orchestration result back into the latest assistant message.
  // Used by ArtifactRenderer → ExecutionPlan's "Refine with feedback" flow.
  // We persist the updated orchestratorOutput so future page loads see
  // the latest cycle (including feedback-aware research updates).
  const handleExecutionPlanRefined = useCallback((result: {
    plan: ExecutionPlanOutput;
    orchestratorOutput?: OrchestratorOutput;
    changes?: RefinementDelta[];
  }) => {
    const { plan, orchestratorOutput, changes } = result;
    setMessages(prev => prev.map(m => {
      if (m.role !== 'assistant' || !m.orchestratorOutput) return m;
      // Only the most recent assistant message gets refined.
      const latestAssistant = [...prev].reverse().find(x => x.role === 'assistant');
      if (m.id !== latestAssistant?.id) return m;

      const updatedOutputs = m.orchestratorOutput.outputs
        .filter(o => o.artifactType !== 'execution-plan')
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

      const deltaLines = (changes ?? []).slice(0, 3).map(d => `- ${d.summary}`);
      const refinedContent = updatedOutput.synthesizedAnswer || (
        deltaLines.length
          ? `${m.content}\n\nFeedback-driven updates:\n${deltaLines.join('\n')}`
          : m.content
      );

      // Best-effort persistence so a later reload reflects the refinement.
      if (currentSessionId && m.persistedId) {
        // Re-save as a new message row rather than mutating the prior row
        // (we don't have an updateMessage helper and keeping history append-only
        // makes the feedback loop auditable).
        saveMessage(currentSessionId, 'assistant', refinedContent, {
          type: 'intelligence',
          orchestratorOutput: updatedOutput,
          recommendations: m.recommendations,
          sources: m.sources,
          suggestions: m.suggestions,
          agentRuns: m.agentRuns,
          refinedFrom: m.persistedId,
        }).then(newId => {
          if (!newId) return;
          setMessages(prev2 => prev2.map(mm =>
            mm.id === m.id ? { ...mm, persistedId: newId } : mm
          ));
        });
      }

      return { ...m, content: refinedContent, orchestratorOutput: updatedOutput };
    }));
  }, [currentSessionId]);

  const handleSend = async (text: string, imagesToSend?: AttachedImage[]) => {
    const images = imagesToSend ?? attachedImages;
    const effectiveText = text.trim() || (images.length > 0 ? 'Analyse the attached image(s).' : '');
    if (!effectiveText || isLoading) return;
    if (selectedAgentIds.length === 0) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        type: 'text',
        content: 'Select at least one agent before running the query.',
      }]);
      return;
    }

    setExpandedDomain(null);
    setFollowUps([]);

    const userMsg: Message = { id: Date.now(), role: 'user', content: effectiveText, images: images.length > 0 ? images : undefined };
    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setAttachedImages([]);
    setIsLoading(true);
    requestAnimationFrame(autoResizeTextarea);

    const assistantId = Date.now() + 1;
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', type: 'intelligence', content: '', agentRuns: [], orchestrationLog: [] }]);

    const imagePayloads: ImageAttachment[] = images.map(img => ({ data: img.data, mimeType: img.mimeType }));

    let finalOutput: OrchestratorOutput | null = null;

    const recalledContext = currentSessionId
      ? await recallContextForSession(currentSessionId, effectiveText)
      : '';
    const userMemoryContext = userMemory ? buildMemoryContext(userMemory) : '';
    const memoryContext = [userMemoryContext, recalledContext].filter(Boolean).join('\n\n');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: effectiveText,
          history,
          images: imagePayloads,
          memoryContext,
          includeMirofish: selectedAgents.mirofish,
          includeMirofishLive: selectedAgents['mirofish-live'],
          selectedAgents: selectedAgentIds,
        }),
      });
      if (res.status === 429) {
        const payload = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(payload.error || 'Rate limit exceeded. Try again later.');
      }
      if (!res.ok || !res.body) throw new Error(`API error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(line.slice(6));

            if (chunk.type === 'agent_update') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? {
                  ...m,
                  agentRuns: [
                    ...(m.agentRuns ?? []).filter(r => r.agentId !== chunk.run.agentId),
                    chunk.run,
                  ],
                  liveMetrics: (chunk.metrics as LiveRunMetrics | undefined) ?? m.liveMetrics,
                } : m
              ));
            }

            if (chunk.type === 'orchestration_log' && typeof chunk.line === 'string') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? {
                  ...m,
                  orchestrationLog: [...(m.orchestrationLog ?? []), chunk.line].slice(-48),
                } : m
              ));
            }

            if (chunk.type === 'result') {
              const out: OrchestratorOutput = chunk.output;
              finalOutput = out;
              if (out.metrics) {
                setSessionUsage(prev => ({
                  queries: prev.queries + 1,
                  totalCostUsd: prev.totalCostUsd + out.metrics!.estimatedCostUsd,
                  totalLatencyMs: prev.totalLatencyMs + out.metrics!.totalLatencyMs,
                  totalGeminiCalls: prev.totalGeminiCalls + out.metrics!.geminiCallCount,
                  totalToolCalls: prev.totalToolCalls + out.metrics!.toolCallCount,
                }));
              } else {
                setSessionUsage(prev => ({ ...prev, queries: prev.queries + 1 }));
              }
              // If mirofish was requested, mark it as running so the sidebar shows it
              if (selectedAgents.mirofish) {
                setMirofishRunning(true);
                setMessages(prev => prev.map(m =>
                  m.id !== assistantId ? m : {
                    ...m,
                    agentRuns: [
                      ...(m.agentRuns ?? []).filter(r => r.agentId !== 'mirofish'),
                      { agentId: 'mirofish', name: 'MiroFish (Forecast)', status: 'running', startedAt: new Date().toISOString() } as AgentRun,
                    ],
                  }
                ));
              }
              // If mirofish-live was requested, mark it as running too
              if (selectedAgents['mirofish-live']) {
                setMessages(prev => prev.map(m =>
                  m.id !== assistantId ? m : {
                    ...m,
                    agentRuns: [
                      ...(m.agentRuns ?? []).filter(r => r.agentId !== 'mirofish-live'),
                      { agentId: 'mirofish-live', name: 'MiroFish Live (Real VPS)', status: 'running', startedAt: new Date().toISOString() } as AgentRun,
                    ],
                  }
                ));
              }
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? {
                  ...m,
                  content: out.synthesizedAnswer,
                  type: 'intelligence',
                  orchestratorOutput: out,
                  recommendations: out.topRecommendations?.map(r => ({
                    title: r.title, rationale: r.rationale,
                    score: r.confidence === 'high' ? 90 : r.confidence === 'medium' ? 65 : 40,
                    confidence: r.confidence, evidence: r.evidence, priority: r.priority,
                  })),
                  sources: filterDisplaySources(
                    out.outputs?.flatMap(o => o.sources?.map(s => ({ title: s.title, url: s.url })) ?? []) ?? [],
                    12,
                  ),
                  suggestions: out.suggestedFollowUps?.slice(0, 3),
                } : m
              ));
            }

            if (chunk.type === 'mirofish_result') {
              const mirofishOut: AgentOutput = chunk.output;
              if (finalOutput) {
                finalOutput = {
                  ...finalOutput,
                  outputs: [
                    ...(finalOutput.outputs ?? []).filter(o => o.domain !== 'mirofish'),
                    mirofishOut,
                  ],
                  agentRuns: [
                    ...(finalOutput.agentRuns ?? []).filter(r => r.agentId !== 'mirofish'),
                    { agentId: 'mirofish', name: 'MiroFish (Forecast)', status: 'completed', confidence: mirofishOut.confidence } as AgentRun,
                  ],
                };
              }
              setMirofishRunning(false);
              setMessages(prev => prev.map(m => {
                if (m.id !== assistantId || !m.orchestratorOutput) return m;
                const updatedOutputs = [
                  ...(m.orchestratorOutput.outputs ?? []).filter(o => o.domain !== 'mirofish'),
                  mirofishOut,
                ];
                return {
                  ...m,
                  orchestratorOutput: { ...m.orchestratorOutput, outputs: updatedOutputs },
                  agentRuns: [
                    ...(m.agentRuns ?? []).filter(r => r.agentId !== 'mirofish'),
                    { agentId: 'mirofish', name: 'MiroFish (Forecast)', status: 'completed', confidence: mirofishOut.confidence } as AgentRun,
                  ],
                };
              }));
            }

            if (chunk.type === 'mirofish_live_result') {
              const liveOut: AgentOutput = chunk.output;
              const liveFailed =
                (Array.isArray(liveOut.interpretation) &&
                  liveOut.interpretation.some(line => /mirofish live unavailable|live swarm unavailable|live swarm interviews failed/i.test(line))) ||
                ((liveOut as any).swarmSize === 0) ||
                (/unavailable|failed/i.test((liveOut as any).rationale ?? ''));
              if (finalOutput) {
                finalOutput = {
                  ...finalOutput,
                  outputs: [
                    ...(finalOutput.outputs ?? []).filter(o => o.domain !== 'mirofish-live'),
                    liveOut,
                  ],
                  agentRuns: [
                    ...(finalOutput.agentRuns ?? []).filter(r => r.agentId !== 'mirofish-live'),
                    {
                      agentId: 'mirofish-live',
                      name: 'MiroFish Live (Real VPS)',
                      status: liveFailed ? 'failed' : 'completed',
                      confidence: liveOut.confidence,
                    } as AgentRun,
                  ],
                };
              }
              setMessages(prev => prev.map(m => {
                if (m.id !== assistantId || !m.orchestratorOutput) return m;
                const updatedOutputs = [
                  ...(m.orchestratorOutput.outputs ?? []).filter(o => o.domain !== 'mirofish-live'),
                  liveOut,
                ];
                return {
                  ...m,
                  orchestratorOutput: { ...m.orchestratorOutput, outputs: updatedOutputs },
                  agentRuns: [
                    ...(m.agentRuns ?? []).filter(r => r.agentId !== 'mirofish-live'),
                    {
                      agentId: 'mirofish-live',
                      name: 'MiroFish Live (Real VPS)',
                      status: liveFailed ? 'failed' : 'completed',
                      confidence: liveOut.confidence,
                    } as AgentRun,
                  ],
                };
              }));
            }

            if (chunk.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: `Analysis failed: ${chunk.message}`, type: 'text' } : m
              ));
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to connect. Please try again.';
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: message } : m
      ));
    } finally {
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, orchestrationLog: undefined } : m
      ));
      setIsLoading(false);
      setMirofishRunning(false);
    }

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
        const sources = filterDisplaySources(
          finalOutput.outputs?.flatMap(o => o.sources?.map(s => ({ title: s.title, url: s.url })) ?? []) ?? [],
          12,
        );

        const persistedAssistantId = await saveMessage(sessionId, 'assistant', finalOutput.synthesizedAnswer, {
          type: 'intelligence',
          orchestratorOutput: finalOutput,
          recommendations: finalOutput.topRecommendations?.map(r => ({
            title: r.title,
            rationale: r.rationale,
            score: r.confidence === 'high' ? 90 : r.confidence === 'medium' ? 65 : 40,
            confidence: r.confidence,
            evidence: r.evidence,
            priority: r.priority,
          })),
          sources,
          suggestions: finalOutput.suggestedFollowUps?.slice(0, 3),
          agentRuns: finalOutput.agentRuns,
        });

        // Stamp the live in-memory message with the Supabase row id so the
        // "Refine with feedback" button can pass a real messageId to /api/refine.
        if (persistedAssistantId) {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, persistedId: persistedAssistantId } : m
          ));
        }

        indexMessageInBackground(sessionId, 'assistant', finalOutput.synthesizedAnswer);

        // Fire-and-forget durable memory extraction (role/company/products/competitors).
        // Never blocks the UI; refreshes local memory once it returns so the next
        // turn already carries the new facts in its memoryContext.
        if (userMemory) {
          extractAndUpdateMemory(sessionId, effectiveText, finalOutput.synthesizedAnswer, userMemory)
            .then(() => refreshUserMemory())
            .catch(() => {});
        }
      }
    }
  };

  const handleFollowUp = async (text: string) => {
    if (!text.trim() || isFollowingUp || isLoading) return;
    const fuId = Date.now();
    setFollowUps(prev => [...prev, { id: fuId, question: text, answer: '', loading: true }]);
    setFollowUpInput('');
    setIsFollowingUp(true);

    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    // Append previous follow-ups so the new follow-up has the full context
    for (const fu of followUps) {
      if (fu.question) history.push({ role: 'user', content: fu.question });
      if (fu.answer && !fu.loading) history.push({ role: 'assistant', content: fu.answer });
    }

    const recalledContext = currentSessionId
      ? await recallContextForSession(currentSessionId, text)
      : '';
    const userMemoryContext = userMemory ? buildMemoryContext(userMemory) : '';
    const memoryContext = [userMemoryContext, recalledContext].filter(Boolean).join('\n\n');
    const lowerFollowUp = text.toLowerCase();
    const followUpMode: 'full' | 'targeted' =
      (lowerFollowUp.includes('full rerun') || lowerFollowUp.includes('full refresh'))
        ? 'full'
        : 'targeted';

    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: text,
          history,
          memoryContext,
          followUpMode,
          includeMirofish: selectedAgents.mirofish,
          selectedAgents: selectedAgentIds,
        }),
      });
      if (res.status === 429) {
        const payload = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(payload.error || 'Rate limit exceeded. Try again later.');
      }
      if (!res.ok || !res.body) throw new Error();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(line.slice(6));
            if (chunk.type === 'result') {
              const out: OrchestratorOutput = chunk.output;
              if (out.metrics) {
                setSessionUsage(prev => ({
                  queries: prev.queries + 1,
                  totalCostUsd: prev.totalCostUsd + out.metrics!.estimatedCostUsd,
                  totalLatencyMs: prev.totalLatencyMs + out.metrics!.totalLatencyMs,
                  totalGeminiCalls: prev.totalGeminiCalls + out.metrics!.geminiCallCount,
                  totalToolCalls: prev.totalToolCalls + out.metrics!.toolCallCount,
                }));
              } else {
                setSessionUsage(prev => ({ ...prev, queries: prev.queries + 1 }));
              }
              const sources = filterDisplaySources(
                out.outputs?.flatMap(o => o.sources?.map(s => ({ title: s.title, url: s.url })) ?? []) ?? [],
                6,
              );
              setFollowUps(prev => prev.map(f =>
                f.id === fuId ? { ...f, answer: out.synthesizedAnswer, sources, loading: false } : f
              ));
              
              if (currentSessionId) {
                await saveMessage(currentSessionId, 'user', text, { isFollowUp: true });
                await saveMessage(currentSessionId, 'assistant', out.synthesizedAnswer, {
                  isFollowUp: true,
                  sources
                });
                indexMessageInBackground(currentSessionId, 'user', text);
                indexMessageInBackground(currentSessionId, 'assistant', out.synthesizedAnswer);

                if (userMemory) {
                  extractAndUpdateMemory(currentSessionId, text, out.synthesizedAnswer, userMemory)
                    .then(() => refreshUserMemory())
                    .catch(() => {});
                }
              }
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setFollowUps(prev => prev.map(f =>
        f.id === fuId ? { ...f, answer: 'Follow-up failed. Please try again.', loading: false } : f
      ));
    } finally {
      setIsFollowingUp(false);
    }
  };

  const handleNewQuery  = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setFollowUps([]);
    setExpandedDomain(null);
    setAttachedImages([]);
    setSessionUsage({ queries: 0, totalCostUsd: 0, totalLatencyMs: 0, totalGeminiCalls: 0, totalToolCalls: 0 });
  };
  const getRunForDomain = (d: Domain) => {
    const runs = currentResult?.agentRuns ?? [];
    const exact = runs.find(r => r.agentId === d);
    if (exact) return exact;

    // Avoid false matches between "mirofish" and "mirofish-live".
    if (d === 'mirofish-live') {
      return runs.find(r => /mirofish live/i.test(r.name ?? ''));
    }
    if (d === 'mirofish') {
      return runs.find(r => /mirofish/i.test(r.name ?? '') && !/mirofish live/i.test(r.name ?? ''));
    }

    return runs.find(r => r.name?.toLowerCase().includes(d.split('-')[0]));
  };
  const getOutputForDomain = (d: Domain) => currentResult?.orchestratorOutput?.outputs?.find(o => o.domain === d);
  const hasLine = (needle: string) => orchestrationLines.some(line => line.toLowerCase().includes(needle.toLowerCase()));
  const researchRuns = (currentResult?.agentRuns ?? []).filter(r =>
    ['market-trends', 'competitive', 'win-loss', 'pricing', 'positioning', 'adjacent'].includes(r.agentId),
  );
  const researchRunning = researchRuns.some(r => r.status === 'running');
  const researchTerminal = researchRuns.length > 0 && researchRuns.every(r => r.status === 'completed' || r.status === 'failed');
  const researchFailed = researchRuns.length > 0 && researchRuns.every(r => r.status === 'failed');
  const executionRun = (currentResult?.agentRuns ?? []).find(r => r.agentId === 'execution-engine');
  const executionSeen = !!executionRun || hasLine('execution intent detected');
  const executionEnabled = selectedAgents['execution-engine'];
  const executionSkipped = !executionSeen && !isLoading;
  const synthesisStarted = hasLine('synthesizing answer') || !!currentResult?.orchestratorOutput;
  const runDone = !!currentResult?.orchestratorOutput && !isLoading;

  const pipelineStages: PipelineStage[] = [
    {
      id: 'reasoning',
      label: 'Reasoning',
      state: runDone || hasLine('reasoning about your query') ? 'completed' : 'running',
    },
    {
      id: 'planning',
      label: 'Orchestrating',
      state: runDone || hasLine('dividing work across') || hasLine('orchestrating parallel research') ? 'completed' : hasLine('starting orchestration') ? 'running' : 'pending',
    },
    {
      id: 'research',
      label: 'Research Swarm',
      state: researchFailed ? 'failed' : researchTerminal || runDone ? 'completed' : researchRunning || hasLine('parallel research') ? 'running' : 'pending',
    },
    {
      id: 'execution',
      label: 'Execution Engine',
      state: executionRun?.status === 'failed'
        ? 'failed'
        : executionRun?.status === 'completed'
          ? 'completed'
          : executionRun?.status === 'running'
            ? 'running'
            : executionSkipped || !executionEnabled
              ? 'completed'
              : executionSeen
                ? 'running'
                : 'pending',
    },
    {
      id: 'synthesis',
      label: 'Synthesis',
      state: runDone ? 'completed' : synthesisStarted ? 'running' : 'pending',
    },
  ];

  const expandedOutput = expandedDomain ? getOutputForDomain(expandedDomain) : null;
  const visibleTabDomains = ALL_DOMAINS.filter(d => {
    const run = getRunForDomain(d);
    const output = getOutputForDomain(d);
    return !!run || !!output || d === 'mirofish';
  });

  /* ─ Neumorphism helpers ─ */
  const sidebarBg  = surface;
  const headerBg   = surface;
  const borderC    = 'transparent';
  const textMain   = text;
  const cardBg     = surface;
  const cardBg2    = surface2;
  const neuExtruded = 'var(--shadow-extruded)';
  const neuInset    = 'var(--shadow-inset)';
  const neuExtrudedSm = 'var(--shadow-extruded-sm)';
  /* Readable accent for text/icons — bright cyan washes out on light surfaces */
  const accentInk = isDark ? '#00C4FF' : '#0052A3';
  const accentInkSoft = isDark ? '#3D9EFF' : '#1A5A9A';

  return (
    <div className={isDark ? 'dark' : 'light'} style={{ display: 'contents' }}>
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">

      {/* ══════════════════════════════════ SIDEBAR ══ */}
      <aside
        className="sidebar-transition flex-shrink-0 flex flex-col h-full relative"
        style={{
          width: sidebarCollapsed ? '0px' : '280px',
          minWidth: sidebarCollapsed ? '0px' : '280px',
          background: sidebarBg,
          borderRight: 'none',
          boxShadow: sidebarCollapsed ? 'none' : neuExtrudedSm,
          overflow: 'visible',
        }}
      >

        {/* Collapse/Expand toggle */}
        <button
          onClick={() => setSidebarCollapsed(prev => !prev)}
          className="sidebar-collapse-btn"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            right: sidebarCollapsed ? '-36px' : '-14px',
          }}
        >
          {sidebarCollapsed ? <PanelLeft size={14} style={{ color: textMuted }} /> : <PanelLeftClose size={14} style={{ color: textMuted }} />}
        </button>

        <div
          className="flex flex-col h-full"
          style={{
            width: '280px',
            opacity: sidebarCollapsed ? 0 : 1,
            transition: 'opacity 0.2s ease',
            overflow: 'hidden',
          }}
        >

          {/* Logo */}
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <img
                src="/robot.avif"
                alt=""
                width={40}
                height={46}
                className="brand-mascot w-10 h-10 shrink-0"
                draggable={false}
              />
              <div className="min-w-0">
                <img
                  src="/logo-text.avif"
                  alt="Veracity"
                  width={140}
                  height={40}
                  className="brand-logo h-6 w-auto max-w-[140px] object-left"
                  draggable={false}
                />
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] leading-none mt-1.5" style={{ color: textSubtle }}>Growth Intelligence</p>
              </div>
            </div>
          </div>

          {/* New query */}
          <div className="px-3 pt-3 pb-2">
            <button
              onClick={() => { handleNewQuery(); }}
              className="bg-gradient-signature w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[13px] font-semibold focus-ring min-h-11"
            >
              <Plus size={14} /> New query
            </button>
          </div>

          {/* ─ Agents panel ─ */}
          <div className="px-3 pb-2">
            <div className="neu-extruded overflow-hidden rounded-[20px]" style={{ background: cardBg2 }}>
              <div className="px-3 py-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Layers size={12} style={{ color: textSubtle }} />
                    <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: textSubtle }}>
                      Agents
                    </span>
                  </div>
                  {isLoading && totalCount > 0 && (
                    <span className="text-[10px] font-semibold flex items-center gap-1" style={{ color: textMuted }}>
                      <RefreshCw size={9} className="animate-spin" /> {completedCount}/{totalCount}
                    </span>
                  )}
                  {hasResult && !isLoading && (
                    <span className="text-[10px] font-semibold" style={{ color: accentInk }}>{completedCount}/{totalCount}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono" style={{ color: textSubtle }}>
                    {selectedAgentIds.length}/{ALL_DOMAINS.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const newState = allSelected
                        ? Object.fromEntries(ALL_DOMAINS.map(d => [d, false])) as Record<Domain, boolean>
                        : Object.fromEntries(ALL_DOMAINS.map(d => [d, d !== 'mirofish-live'])) as Record<Domain, boolean>;
                      setSelectedAgents(newState);
                    }}
                    className={`select-all-btn font-mono flex items-center gap-1 ${allSelected ? 'all-selected' : ''}`}
                  >
                    <CheckCheck size={10} />
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>
              <div className="py-1.5 px-1.5 flex flex-col gap-0.5">
                {ALL_DOMAINS.map(d => (
                  <SidebarAgentRow
                    key={d}
                    domain={d}
                    run={getRunForDomain(d)}
                    selected={selectedAgents[d]}
                    onToggle={() => setSelectedAgents(prev => ({ ...prev, [d]: !prev[d] }))}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Recent sessions */}
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            <div className="neu-extruded overflow-hidden rounded-[20px]" style={{ background: cardBg2 }}>
              <div className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <History size={12} style={{ color: textSubtle }} />
                  <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: textSubtle }}>Recent</span>
                </div>
                {sessions.length > 0 && (
                  <span className="text-[10px] font-semibold" style={{ color: textSubtle }}>{sessions.length}</span>
                )}
              </div>
              <div className="py-1.5 px-1.5">
                {loadingSessions ? (
                  <div className="px-2 py-3 flex flex-col gap-2">
                    <div className="h-3 rounded skeleton w-4/5" />
                    <div className="h-3 rounded skeleton w-3/5" style={{ animationDelay: '0.2s' }} />
                    <div className="h-3 rounded skeleton w-2/3" style={{ animationDelay: '0.4s' }} />
                  </div>
                ) : sessions.length > 0 ? (
                  <div className="flex flex-col gap-0.5">
                    {sessions.slice(0, 10).map((session) => (
                      <div
                        key={session.id}
                        className={`session-item group relative flex items-center cursor-pointer ${currentSessionId === session.id ? 'active' : ''}`}
                        onClick={() => { loadSession(session.id); }}
                      >
                        <div className="flex-1 min-w-0 pr-6">
                          <p className="text-[12px] font-medium truncate" style={{
                            color: currentSessionId === session.id ? textMain : textMuted,
                          }}>
                            {session.title}
                          </p>
                          {session.created_at && (
                            <p className="text-[9px] font-medium mt-0.5" style={{ color: textSubtle }}>
                              {new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await deleteSession(session.id);
                            if (currentSessionId === session.id) {
                              handleNewQuery();
                            }
                            await refreshSessions();
                          }}
                          className="absolute right-1.5 w-7 h-7 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                          style={{ color: '#0B1A2E' }}
                          title="Delete session"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-4 text-center">
                    <p className="text-[11px]" style={{ color: textSubtle }}>No sessions yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 flex items-center gap-2">
            <div className="live-dot" />
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: textSubtle }}>live · sourced · grounded</span>
          </div>
        </div>
      </aside>

      {/* ═══════════════════════════════════ MAIN ══ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* ── Floating header island ── */}
        <div
          className={`shrink-0 z-30 px-3 md:px-5 pt-3 pb-1 ${sidebarCollapsed ? 'pl-12 md:pl-14' : ''}`}
        >
          <header
            ref={headerIslandRef}
            className={`header-island ${headerCompact ? 'header-island--compact' : ''} ${sidebarCollapsed ? 'header-island--rail' : ''}`}
            style={{ background: headerBg }}
          >
            {/* Brand — only when sidebar is collapsed */}
            {sidebarCollapsed && (
              <div className="header-island-brand flex items-center shrink-0 pl-1 pr-3">
                <img
                  src="/logo.avif"
                  alt="Veracity"
                  width={140}
                  height={36}
                  className="brand-logo h-8 w-auto object-left object-contain"
                  draggable={false}
                />
              </div>
            )}

            {/* View tabs */}
            <div className="header-island-tabs flex items-center gap-1.5 shrink-0">
              {[
                { id: 'intelligence' as const, label: 'Intelligence', icon: <Sparkles size={12} /> },
                { id: 'usage' as const, label: 'API usage', icon: <BarChart3 size={12} /> },
                { id: 'steal' as const, label: 'Steal strategy', icon: <Crosshair size={12} /> },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTopTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all min-h-9"
                  style={{
                    color: topTab === tab.id ? accentInk : textMuted,
                    background: 'var(--background)',
                    border: 'none',
                    boxShadow: topTab === tab.id ? 'var(--shadow-inset-sm)' : 'var(--shadow-extruded-sm)',
                  }}
                >
                  {tab.icon}
                  <span className="header-island-tab-label">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Stats + actions */}
            <div className="header-island-row flex items-center gap-2 sm:gap-3 ml-auto min-w-0">
              <div className="header-island-stats flex items-center gap-2.5 sm:gap-3 text-[11px] font-medium shrink-0" style={{ color: textMuted }}>
                <span className="flex items-center gap-1.5"><Activity size={11} style={{ color: textSubtle }} /> &lt;5 min</span>
                <span className="hidden md:flex items-center gap-1.5"><Shield size={11} style={{ color: textSubtle }} /> sourced</span>
                <span className="hidden lg:flex items-center gap-1.5"><Zap size={11} style={{ color: textSubtle }} /> 16+ signals</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {selectedAgents.mirofish && (
                  <span className="neu-pill-accent shrink-0 hidden xl:flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 header-island-chip">
                    {mirofishRunning ? <RefreshCw size={10} className="animate-spin" /> : <Fish size={10} />} forecast
                  </span>
                )}
                {selectedAgents['mirofish-live'] && (
                  <span className="neu-pill-positive shrink-0 hidden xl:flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 header-island-chip">
                    <Fish size={10} /> live VPS
                  </span>
                )}
                <button
                  onClick={toggleTheme}
                  className="neu-extruded-sm w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ color: textMuted }}
                  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {isDark ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                <div className="relative shrink-0">
                  <button onClick={() => setShowUserMenu(v => !v)}
                    className="header-avatar w-9 h-9 flex items-center justify-center text-[12px] font-bold shrink-0 text-white"
                    title={userEmail || 'Account'}
                  >
                    {userEmail ? userEmail[0].toUpperCase() : <User size={13} />}
                  </button>
                  {showUserMenu && (
                    <div className="veracity-card absolute right-0 top-11 w-52 py-1.5 z-50">
                      {userEmail && (
                        <p className="px-3 py-2 text-[12px] font-medium truncate" style={{ color: textMuted }}>{userEmail}</p>
                      )}
                      <button onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left transition-colors hover:bg-muted"
                        style={{ color: textMuted }}>
                        <LogOut size={13} style={{ color: textSubtle }} /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>
        </div>

        {/* ── Body ── */}
        <div
          ref={mainScrollRef}
          onScroll={onMainScroll}
          className="flex-1 overflow-y-auto"
          style={{ padding: 'clamp(16px, 3vw, 32px)', paddingBottom: 'clamp(24px, 4vw, 40px)' }}
        >
          <div className="flex flex-col gap-7 max-w-[1400px] w-full mx-auto">

            {topTab === 'usage' && (
              <ApiUsagePanel
                lastMetrics={currentResult?.orchestratorOutput?.metrics}
                lastLive={currentResult?.liveMetrics}
                sessionTotals={sessionUsage}
              />
            )}

            {topTab === 'steal' && <StealStrategyPanel />}

            {topTab === 'intelligence' && (
            <>
            {/* Empty state — brand left, suggestions right */}
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col lg:flex-row items-center lg:items-center justify-center gap-10 lg:gap-14 min-h-[58vh] px-2 w-full max-w-5xl mx-auto">
                {/* Left — non-clickable brand copy */}
                <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-md">
                  <img
                    src="/robot.avif"
                    alt=""
                    width={140}
                    height={148}
                    className="brand-mascot w-[7.5rem] h-auto mb-5 animate-float drop-shadow-md"
                    draggable={false}
                  />
                  <p className="label-mono mb-3 flex justify-center lg:justify-start">Boardroom brief in minutes</p>
                  <h2 className="empty-heading mb-3">
                    Ask a growth question
                  </h2>
                  <p className="text-[14px] leading-relaxed" style={{ color: textMuted }}>
                    Six specialist agents pull live signals, score confidence, and render findings inline — not as chat walls.
                  </p>
                </div>

                {/* Right — clickable suggestions */}
                <div className="flex-1 flex flex-col gap-2.5 w-full max-w-xl">
                  {DEMO_QUERIES.map(q => (
                    <button key={q} onClick={() => handleSend(q)} className="suggest-row">
                      <span className="neu-well w-8 h-8 shrink-0">
                        <Search size={13} className="text-accent" />
                      </span>
                      <span className="flex-1 demo-query-text text-left">{q}</span>
                      <ChevronRight size={14} style={{ color: textSubtle, flexShrink: 0 }} />
                    </button>
                  ))}
                  <div className="flex flex-col gap-2 mt-2">
                    <p className="label-mono text-left">Generalize to another product</p>
                    <button
                      onClick={() => handleSend('What should Clay build or reposition over the next six months to capture emerging demand?')}
                      className="suggest-row"
                    >
                      <span className="neu-well w-8 h-8 shrink-0">
                        <Layers size={13} className="text-accent" />
                      </span>
                      <span className="flex-1 demo-query-text text-left">What should Clay build or reposition over the next six months to capture emerging demand?</span>
                      <ChevronRight size={14} style={{ color: textSubtle, flexShrink: 0 }} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Agent Tabs ── */}
            {(currentResult || isLoading) && (
              <div className="veracity-card p-5" style={{ background: cardBg }}>
                <div className="flex items-center justify-between mb-5 gap-3">
                  <div className="flex flex-col gap-2 min-w-0 flex-1">
                    <p className="text-[16px] font-bold tracking-tight" style={{ color: textMain }}>
                      {recentQueries[recentQueries.length - 1] ?? 'analysing…'}
                    </p>
                    {messages.filter(m => m.role === 'user').pop()?.images && (
                      <div className="flex flex-wrap gap-2">
                        {messages.filter(m => m.role === 'user').pop()?.images?.map((img, i) => (
                          <img key={i} src={img.dataUrl} alt={img.name} className="h-10 w-10 object-cover rounded-lg" style={{ border: 'none', boxShadow: neuExtrudedSm }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      {ALL_DOMAINS.map(d => {
                        const s = getRunForDomain(d)?.status ?? 'idle';
                        const m = DOMAIN_META[d];
                        const dot = domainAccent(m, isDark);
                        return (
                          <div key={d} className="w-2.5 h-2.5 rounded-full transition-all"
                            style={{
                              background: s === 'completed' ? dot : s === 'running' ? dot : (isDark ? '#2a2a2a' : '#ddd'),
                              opacity: s === 'running' ? 1 : s === 'completed' ? 1 : 0.4,
                              boxShadow: s === 'running' ? `0 0 6px ${dot}55` : 'none',
                            }}
                          />
                        );
                      })}
                    </div>
                    {totalCount > 0 && (
                      <span className="text-[11px] font-mono font-semibold" style={{ color: textSubtle }}>
                        {completedCount}/{Math.max(totalCount, 6)}
                      </span>
                    )}
                  </div>
                </div>

                {isLoading && orchLogLen > 0 && (
                  <div className="mb-4 neu-inset rounded-[16px] px-3 py-3" style={{ background: cardBg2 }}>
                    <div className="flex items-center gap-1.5 mb-2 text-[10px] font-mono uppercase tracking-widest" style={{ color: textSubtle }}>
                      <Activity size={11} className="shrink-0 animate-pulse" />
                      <span>Pipeline</span>
                    </div>
                    <div className="overflow-x-auto pb-1">
                      <div className="min-w-[620px] flex items-center gap-2.5">
                        {pipelineStages.map((stage, i) => {
                          const stateColor = stage.state === 'failed'
                            ? '#0B1A2E'
                            : stage.state === 'completed'
                              ? accentInk
                              : stage.state === 'running'
                                ? accentInk
                                : textSubtle;
                          const fill = stage.state === 'completed' ? '100%' : stage.state === 'running' ? '62%' : '0%';
                          return (
                            <React.Fragment key={stage.id}>
                              <div className="flex flex-col items-center gap-1.5 min-w-[108px]">
                                <div
                                  className="relative w-8 h-8 rounded-full overflow-hidden"
                                  style={{
                                    border: `1.5px solid ${stage.state === 'pending' ? borderC : stateColor}`,
                                    background: stage.state === 'pending' ? 'transparent' : `${stateColor}22`,
                                    boxShadow: stage.state === 'running' ? `0 0 0 1px ${stateColor}33, 0 0 10px ${stateColor}44` : 'none',
                                  }}
                                >
                                  <div
                                    className={stage.state === 'running' ? 'animate-pulse' : ''}
                                    style={{
                                      position: 'absolute',
                                      left: 0,
                                      bottom: 0,
                                      width: '100%',
                                      height: fill,
                                      background: `linear-gradient(180deg, ${stateColor}88 0%, ${stateColor}cc 100%)`,
                                      transition: 'height 500ms ease',
                                    }}
                                  />
                                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-bold" style={{ color: stage.state === 'pending' ? textSubtle : '#fff' }}>
                                    {i + 1}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono uppercase tracking-wide text-center leading-tight" style={{ color: stage.state === 'pending' ? textSubtle : textMain }}>
                                  {stage.label}
                                </span>
                              </div>
                              {i < pipelineStages.length - 1 && (
                                <div className="relative h-2.5 w-12 rounded-full overflow-hidden" style={{ border: 'none', boxShadow: neuExtrudedSm, background: isDark ? '#151515' : '#f4f4f5' }}>
                                  <div
                                    className={stage.state === 'running' ? 'animate-pulse' : ''}
                                    style={{
                                      height: '100%',
                                      width: stage.state === 'pending' ? '0%' : stage.state === 'running' ? '55%' : '100%',
                                      background: `linear-gradient(90deg, ${stateColor}99 0%, ${stateColor}dd 100%)`,
                                      transition: 'width 450ms ease',
                                    }}
                                  />
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2.5">
                  {visibleTabDomains.map(domain => {
                    const run = getRunForDomain(domain);
                    const output = getOutputForDomain(domain);
                    const isActive = expandedDomain === domain;
                    const status = run?.status ?? (output ? 'completed' : 'idle');
                    const meta = DOMAIN_META[domain];
                    const dAccent = domainAccent(meta, isDark);
                    return (
                      <button
                        key={domain}
                        onClick={() => setExpandedDomain(domain)}
                        className="px-3.5 py-2.5 rounded-2xl text-left transition-all min-w-[140px]"
                        style={{
                          background: isActive ? (isDark ? meta.bg : meta.bgLight) : 'var(--background)',
                          boxShadow: isActive
                            ? `var(--shadow-inset-sm), 0 0 0 2px ${dAccent}44`
                            : 'var(--shadow-extruded-sm)',
                          border: 'none',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span style={{ color: isActive ? dAccent : textSubtle }}>{meta.icon}</span>
                            <span className="text-[11px] font-mono font-bold uppercase tracking-wide" style={{ color: isActive ? dAccent : textMuted }}>
                              {meta.short}
                            </span>
                          </div>
                          {status === 'running' && <RefreshCw size={11} className="animate-spin" style={{ color: dAccent }} />}
                          {status === 'completed' && <CheckCircle2 size={12} style={{ color: accentInk }} />}
                          {status === 'failed' && <AlertCircle size={11} style={{ color: '#0B1A2E' }} />}
                        </div>
                        <p className="text-[10px] font-mono mt-1.5 uppercase tracking-wider font-medium" style={{
                          color: status === 'completed' ? accentInk : status === 'running' ? dAccent : textSubtle,
                        }}>
                          {status}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Expanded domain ── */}
            {expandedDomain && (
              <div className="veracity-card overflow-hidden" style={{
                background: cardBg,
                boxShadow: `var(--shadow-extruded), 0 0 0 2px ${domainAccent(DOMAIN_META[expandedDomain], isDark)}33`,
              }}>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="neu-well w-9 h-9">
                      <span style={{ color: domainAccent(DOMAIN_META[expandedDomain], isDark) }}>{DOMAIN_META[expandedDomain].icon}</span>
                    </div>
                    <span className="text-[15px] font-display font-extrabold tracking-tight" style={{ color: textMain }}>
                      {DOMAIN_META[expandedDomain].label}
                    </span>
                    {expandedOutput && <ConfidenceBadge level={expandedOutput.confidence} />}
                    <span className="neu-pill-accent text-[9px] font-mono font-semibold uppercase tracking-widest px-2.5 py-0.5"
                      style={{ color: domainAccent(DOMAIN_META[expandedDomain], isDark) }}>
                      live
                    </span>
                  </div>
                  <button onClick={() => setExpandedDomain(null)}
                    className="neu-extruded-sm w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ color: textMuted }}
                    aria-label="Close">
                    <X size={15} />
                  </button>
                </div>

                <div className="p-6 lg:p-8 flex flex-col gap-5">
                  {expandedOutput ? (
                    <ArtifactRenderer
                      output={expandedOutput}
                      product={currentResult?.orchestratorOutput?.product ?? ''}
                      sessionId={currentSessionId}
                      messageId={currentResult?.persistedId ?? null}
                      onRefined={handleExecutionPlanRefined}
                    />
                  ) : (
                    <div className="neu-inset rounded-3xl p-6">
                      <p className="text-sm font-bold mb-2" style={{ color: textMain }}>
                        {DOMAIN_META[expandedDomain].short} details are loading
                      </p>
                      <p className="text-[13px] leading-relaxed" style={{ color: textMuted }}>
                        This agent is still running or returned no structured artifact yet. Try rerunning with MiroFish enabled and a forecast-style prompt.
                      </p>
                    </div>
                  )}

                  {expandedOutput && expandedOutput.facts.filter(f => !f.startsWith('[')).length > 0 && (
                    <div className="neu-extruded rounded-3xl p-5">
                      <p className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: '#2C7A7B' }}>
                        <span className="neu-well w-7 h-7">
                          <CheckCircle2 size={13} style={{ color: accentInk }} />
                        </span>
                        Key Facts
                      </p>
                      <ul className="flex flex-col gap-3">
                        {expandedOutput.facts.filter(f => !f.startsWith('[')).map((f, i) => (
                          <li key={i} className="neu-inset rounded-2xl px-3.5 py-2.5 flex items-start gap-3 text-[13.5px] leading-relaxed" style={{ color: textMuted, boxShadow: 'var(--shadow-inset-sm)' }}>
                            <span className="font-mono mt-0.5 shrink-0 font-bold" style={{ color: accentInk }}>✓</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {expandedOutput && expandedOutput.interpretation.length > 0 && (
                    <div className="neu-extruded rounded-3xl p-5">
                      <p className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: accentInk }}>
                        <span className="neu-well w-7 h-7">
                          <Activity size={13} className="text-accent" />
                        </span>
                        Analysis
                      </p>
                      <ul className="flex flex-col gap-3">
                        {expandedOutput.interpretation.map((interp, i) => (
                          <li key={i} className="neu-inset rounded-2xl px-3.5 py-2.5 flex items-start gap-3 text-[13.5px] leading-relaxed" style={{ color: textMuted, boxShadow: 'var(--shadow-inset-sm)' }}>
                            <span className="font-mono mt-0.5 shrink-0 font-bold text-accent">›</span>
                            <span>{interp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Summary card ── */}
            {currentResult?.content && (
              <div className="rounded-lg overflow-hidden" style={{ background: cardBg, boxShadow: neuExtruded, border: 'none' }}>
                <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: 'none' }}>
                  <div className="flex items-center gap-2">
                    <Layers size={14} style={{ color: accentInk }} />
                    <span className="text-[12px] font-mono font-semibold uppercase tracking-widest" style={{ color: textMuted }}>
                      Intelligence Summary
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Cost + latency + agent count metrics.
                        Prefers the authoritative RunMetrics on the final result;
                        falls back to live streamed metrics while agents are still
                        running so the demo judge always sees numbers moving. */}
                    {(() => {
                      const final = currentResult.orchestratorOutput?.metrics;
                      const live = currentResult.liveMetrics;
                      if (!final && !live) return null;
                      const latencyMs = final?.totalLatencyMs ?? live?.elapsedMs ?? 0;
                      const cost = final?.estimatedCostUsd ?? live?.estimatedCostUsd ?? 0;
                      const agentTotal = final?.agentCount ?? live?.agentCount ?? 0;
                      const agentDone = final?.completedAgentCount ?? live?.completedAgentCount ?? 0;
                      const geminiCalls = final?.geminiCallCount ?? live?.geminiCallCount ?? 0;
                      const toolCalls = final?.toolCallCount ?? live?.toolCallCount ?? 0;
                      const isLive = !final && !!live;
                      return (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded flex items-center gap-2"
                          style={{ color: textSubtle, background: cardBg2, boxShadow: neuExtrudedSm, border: 'none' }}>
                          {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ background: '#3D9EFF' }} />}
                          <span title="Wall-clock latency">{(latencyMs / 1000).toFixed(1)}s</span>
                          <span style={{ opacity: 0.3 }}>|</span>
                          <span title="Estimated cost">${cost.toFixed(4)}</span>
                          <span style={{ opacity: 0.3 }}>|</span>
                          <span title="Agents completed / dispatched">{agentDone}/{agentTotal} agents</span>
                          <span style={{ opacity: 0.3 }}>|</span>
                          <span title="Model calls">{isLive ? `~${geminiCalls}` : geminiCalls} calls</span>
                          <span style={{ opacity: 0.3 }}>|</span>
                          <span title="External tool invocations">{isLive ? `~${toolCalls}` : toolCalls} tools</span>
                        </span>
                      );
                    })()}
                    {currentResult.orchestratorOutput?.product && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded"
                        style={{ color: accentInk, background: 'rgba(0,196,255,0.1)', border: '1px solid rgba(0,196,255,0.2)' }}>
                        {currentResult.orchestratorOutput.product}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-6 lg:p-8 flex flex-col gap-8">
                  <p className="prose-answer">{currentResult.content}</p>

                  {(() => {
                    const refinement = currentResult.orchestratorOutput?.refinement;
                    const sourceMix = buildSourceMix(currentResult.orchestratorOutput?.outputs ?? []);
                    const researchRuns = (currentResult.agentRuns ?? []).filter(r => ['market-trends', 'competitive', 'win-loss', 'pricing', 'positioning', 'adjacent'].includes(r.agentId));
                    const executionRun = (currentResult.agentRuns ?? []).find(r => r.agentId === 'execution-engine');
                    const researchDone = researchRuns.filter(r => r.status === 'completed').length;
                    const researchFailed = researchRuns.filter(r => r.status === 'failed').length;
                    return (
                      <div className="flex flex-col gap-3 rounded-lg p-4" style={{ background: cardBg2, boxShadow: neuExtrudedSm, border: 'none' }}>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-wider" style={{ color: textSubtle }}>
                          <span>Phases</span>
                          <span className="px-2 py-0.5 rounded-full" style={{ color: researchDone + researchFailed >= 6 ? accentInk : accentInk, background: researchDone + researchFailed >= 6 ? 'rgba(0,196,255,0.08)' : 'rgba(0,196,255,0.08)', border: `1px solid ${researchDone + researchFailed >= 6 ? 'rgba(0,196,255,0.2)' : 'rgba(0,196,255,0.2)'}` }}>
                            research {researchDone}/{Math.max(researchRuns.length, 6)}{researchFailed > 0 ? ` · ${researchFailed} failed` : ''}
                          </span>
                          <span className="px-2 py-0.5 rounded-full" style={{ color: executionRun?.status === 'completed' ? accentInk : executionRun?.status === 'running' ? accentInk : textSubtle, background: executionRun?.status === 'completed' ? 'rgba(0,196,255,0.08)' : executionRun?.status === 'running' ? 'rgba(0,196,255,0.08)' : 'transparent', border: `1px solid ${executionRun?.status === 'completed' ? 'rgba(0,196,255,0.2)' : executionRun?.status === 'running' ? 'rgba(0,196,255,0.2)' : borderC}` }}>
                            execution {executionRun?.status ?? 'idle'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full" style={{ color: refinement ? accentInk : textSubtle, background: refinement ? 'rgba(0,196,255,0.08)' : 'transparent', border: `1px solid ${refinement ? 'rgba(0,196,255,0.2)' : borderC}` }}>
                            refinement {refinement ? 'applied' : 'idle'}
                          </span>
                        </div>

                        {sourceMix.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono" style={{ color: textSubtle }}>
                            <span className="uppercase tracking-wider">Source mix</span>
                            {sourceMix.map(({ tool, count }) => (
                              <span key={tool} className="px-2 py-0.5 rounded-full" style={{ color: accentInk, background: 'rgba(0,196,255,0.08)', border: '1px solid rgba(0,196,255,0.2)' }}>
                                {tool} × {count}
                              </span>
                            ))}
                          </div>
                        )}

                        {refinement && refinement.deltas.length > 0 && (
                          <div className="rounded-md p-3" style={{ background: cardBg, boxShadow: neuExtruded, border: 'none' }}>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <div>
                                <p className="text-[10px] font-mono uppercase tracking-widest" style={{ color: textSubtle }}>Before / after refinement</p>
                                <p className="text-[11px] mt-1" style={{ color: textMuted }}>{refinement.feedbackApplied.variantResults} variant results, {refinement.feedbackApplied.recommendationFeedback} ratings, {refinement.feedbackApplied.recommendationActions} actions</p>
                              </div>
                              {refinement.focus && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ color: accentInk, background: 'rgba(0,196,255,0.08)', border: '1px solid rgba(0,196,255,0.2)' }}>{refinement.focus}</span>}
                            </div>
                            <div className="flex flex-col gap-2">
                              {refinement.deltas.slice(0, 3).map(delta => (
                                <div key={`${delta.domain}-${delta.summary}`} className="rounded-md p-2.5" style={{ background: cardBg2, boxShadow: neuExtrudedSm, border: 'none' }}>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: accentInk }}>{delta.domain}</span>
                                    {delta.beforeConfidence && <ConfidenceBadge level={delta.beforeConfidence} />}
                                    <ArrowUpRight size={10} style={{ color: textSubtle, transform: 'rotate(45deg)' }} />
                                    {delta.afterConfidence && <ConfidenceBadge level={delta.afterConfidence} />}
                                  </div>
                                  <p className="text-[11px] mt-1" style={{ color: textMuted }}>{delta.summary}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {currentResult.orchestratorOutput?.outputs?.length ? (
                    <div>
                      <p className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: textSubtle }}>
                        <Layers size={13} /> Domain Highlights
                      </p>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {currentResult.orchestratorOutput.outputs
                          .filter(o => o.artifactType !== 'mind-map')
                          .slice(0, 6)
                          .map((o, i) => {
                            const domainMeta = DOMAIN_META[o.domain as Domain];
                            return (
                              <div key={`${o.domain}-${i}`} className="rounded-xl p-4 transition-all"
                                style={{
                                  background: cardBg2,
                                  border: 'none', boxShadow: neuExtrudedSm,
                                  borderLeft: `3px solid ${domainMeta?.color ?? borderC}`,
                                }}>
                                <div className="flex items-center justify-between mb-2.5">
                                  <div className="flex items-center gap-1.5">
                                    {domainMeta && <span style={{ color: domainMeta.color }}>{domainMeta.icon}</span>}
                                    <span className="text-[12px] font-mono font-bold uppercase tracking-wide" style={{ color: domainMeta ? domainAccent(domainMeta, isDark) : textSubtle }}>
                                      {domainMeta?.short ?? o.domain}
                                    </span>
                                  </div>
                                  <ConfidenceBadge level={o.confidence} />
                                </div>
                                <p className="text-[13px] leading-relaxed font-medium" style={{ color: isDark ? '#d4d4d4' : '#333' }}>
                                  {o.interpretation?.[0] || o.facts?.[0] || 'No highlight available.'}
                                </p>
                                {o.sources?.length ? (
                                  <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5" style={{ borderTop: 'none' }}>
                                    {o.sources.slice(0, 2).map(source => (
                                      <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md transition-colors"
                                        style={{ color: textMuted, background: cardBg, boxShadow: neuExtruded, border: 'none' }}>
                                        {source.title} <ArrowUpRight size={8} />
                                      </a>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ) : null}

                  {/* Recommendations */}
                  {currentResult.recommendations && currentResult.recommendations.length > 0 && (
                    <div>
                      <p className="text-[11px] font-mono font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: textSubtle }}>
                        <Rocket size={13} /> Strategic Recommendations
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {currentResult.recommendations.map((rec: any, i: number) => (
                          <div key={i} className="rounded-lg p-4 flex flex-col gap-2.5"
                            style={{ background: cardBg2, boxShadow: neuExtrudedSm, border: 'none' }}>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded uppercase" style={{
                                color:   rec.priority === 'immediate' ? '#0B1A2E' : rec.priority === 'short-term' ? '#3D9EFF' : '#3D9EFF',
                                background: rec.priority === 'immediate' ? 'rgba(11,26,46,0.1)' : rec.priority === 'short-term' ? 'rgba(61,158,255,0.1)' : 'rgba(61,158,255,0.1)',
                                border: `1px solid ${rec.priority === 'immediate' ? 'rgba(11,26,46,0.25)' : rec.priority === 'short-term' ? 'rgba(61,158,255,0.25)' : 'rgba(61,158,255,0.25)'}`,
                              }}>{rec.priority ?? 'strategic'}</span>
                              <ConfidenceBadge level={rec.confidence ?? (rec.score >= 80 ? 'high' : rec.score >= 55 ? 'medium' : 'low')} />
                            </div>
                            <h4 className="rec-title">{rec.title}</h4>
                            <p className="rec-body">{rec.rationale}</p>
                            {rec.evidence?.length > 0 && (
                              <ul className="flex flex-col gap-1 mt-1">
                                {rec.evidence.map((e: string, ei: number) => (
                                  <li key={ei} className="text-[11px] flex items-start gap-1.5" style={{ color: textSubtle }}>
                                    <span className="font-mono mt-0.5 shrink-0" style={{ color: isDark ? '#333' : '#ccc' }}>›</span>{e}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {/* Feedback thumbs — fire-and-forget to /api/feedback */}
                            {currentSessionId && (() => {
                              const rk = recommendationKey(rec.title ?? '', rec.rationale ?? '');
                              const current = ratedRecs[rk];
                              const rate = (rating: RecommendationRating) => {
                                setRatedRecs(prev => ({ ...prev, [rk]: rating }));
                                rateRecommendation({
                                  sessionId: currentSessionId,
                                  title: rec.title,
                                  rationale: rec.rationale,
                                  rating,
                                });
                              };
                              return (
                                <div className="flex items-center gap-1.5 mt-1 pt-2" style={{ borderTop: 'none' }}>
                                  <button type="button" onClick={() => rate('up')} title="Useful"
                                    className="p-1 rounded transition-colors" style={{
                                      color: current === 'up' ? accentInk : textSubtle,
                                      background: current === 'up' ? 'rgba(0,196,255,0.12)' : 'transparent',
                                    }}>
                                    <ThumbsUp size={12} />
                                  </button>
                                  <button type="button" onClick={() => rate('down')} title="Not useful"
                                    className="p-1 rounded transition-colors" style={{
                                      color: current === 'down' ? '#0B1A2E' : textSubtle,
                                      background: current === 'down' ? 'rgba(11,26,46,0.12)' : 'transparent',
                                    }}>
                                    <ThumbsDown size={12} />
                                  </button>
                                  {current && (
                                    <span className="text-[9px] font-mono ml-1" style={{ color: current === 'up' ? accentInk : '#0B1A2E' }}>
                                      {current === 'up' ? 'Validated' : 'Rejected'}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sources */}
                  {currentResult.sources && currentResult.sources.length > 0 && (
                    <div className="flex items-start gap-3 pt-4" style={{ borderTop: 'none' }}>
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-widest shrink-0 mt-1" style={{ color: textSubtle }}>sources</span>
                      <div className="flex flex-wrap gap-1.5">
                        {currentResult.sources.map(source => (
                          <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] font-mono px-2.5 py-1 rounded-md transition-colors"
                            style={{ background: cardBg2, boxShadow: neuExtrudedSm, border: 'none', color: textMuted }}
                            onMouseEnter={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.color = accentInk; a.style.borderColor = isDark ? 'rgba(0,196,255,0.3)' : 'rgba(0,82,163,0.35)'; }}
                            onMouseLeave={e => { const a = e.currentTarget as HTMLAnchorElement; a.style.color = textMuted; a.style.borderColor = borderC; }}>
                            {source.title} <ArrowUpRight size={9} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {currentResult.suggestions && currentResult.suggestions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-3" style={{ borderTop: 'none' }}>
                      <span className="text-[10px] font-mono font-semibold uppercase tracking-widest" style={{ color: textSubtle }}>dig deeper</span>
                      {currentResult.suggestions.map(sug => (
                        <button
                          key={sug}
                          type="button"
                          disabled={isFollowingUp || isLoading}
                          onClick={() => {
                            followUpEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            // Let the scroll start before kicking off the streamed request so the composer stays in view.
                            requestAnimationFrame(() => {
                              void handleFollowUp(sug);
                            });
                          }}
                          className="text-[12px] font-medium flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all disabled:opacity-45 disabled:pointer-events-none"
                          style={{ background: cardBg2, boxShadow: neuExtrudedSm, border: 'none', color: textMuted }}
                          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; if (b.disabled) return; b.style.color = accentInk; b.style.borderColor = isDark ? 'rgba(0,196,255,0.4)' : 'rgba(0,82,163,0.4)'; b.style.background = isDark ? 'rgba(0,196,255,0.06)' : 'rgba(0,82,163,0.06)'; }}
                          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = textMuted; b.style.borderColor = borderC; b.style.background = cardBg2; }}>
                          {sug} <ChevronRight size={11} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Inline Mind Map ── */}
            {(() => {
              const mindMapOutput = currentResult?.orchestratorOutput?.outputs?.find(o => o.artifactType === 'mind-map') as MindMapOutput | undefined;
              if (!mindMapOutput?.branches?.length) return null;
              return (
                <div className="rounded-lg overflow-hidden" style={{ background: cardBg, boxShadow: neuExtruded, border: 'none' }}>
                  <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: 'none' }}>
                    <GitBranch size={14} style={{ color: accentInk }} />
                    <span className="text-[12px] font-mono font-semibold uppercase tracking-widest" style={{ color: textMuted }}>
                      Mind Map
                    </span>
                  </div>
                  <div className="p-4">
                    <ArtifactRenderer output={mindMapOutput} product={currentResult?.orchestratorOutput?.product ?? ''} />
                  </div>
                </div>
              );
            })()}

            {/* ── Follow-up answers ── */}
            {followUps.map(fu => (
              <div key={fu.id} className="rounded-lg overflow-hidden"
                style={{ border: 'none', boxShadow: neuExtrudedSm, borderLeft: `2px solid ${accentInk}`, background: cardBg }}>
                <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: 'none' }}>
                  <MessageSquarePlus size={13} style={{ color: accentInk }} />
                  <p className="text-[13px] font-mono" style={{ color: textMain }}>{fu.question}</p>
                </div>
                <div className="p-4">
                  {fu.loading ? (
                    <div className="flex flex-col gap-2">
                      <div className="h-3 rounded skeleton w-3/4" />
                      <div className="h-3 rounded skeleton w-full" style={{ animationDelay: '0.2s' }} />
                      <div className="h-3 rounded skeleton w-5/6" style={{ animationDelay: '0.4s' }} />
                    </div>
                  ) : (
                    <>
                      <p className="followup-answer whitespace-pre-line">{fu.answer}</p>
                      {fu.sources && fu.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: 'none' }}>
                          {fu.sources.map(s => (
                            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded transition-colors"
                              style={{ background: cardBg2, boxShadow: neuExtrudedSm, border: 'none', color: textMuted }}>
                              {s.title} <ArrowUpRight size={8} />
                            </a>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* ── Follow-up input ── */}
            {hasResult && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-lg px-4 py-3"
                style={{ background: cardBg, boxShadow: neuExtruded, border: 'none' }}
                ref={followUpEndRef}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <MessageSquarePlus size={14} style={{ color: textSubtle, flexShrink: 0 }} />
                  <input
                    type="text"
                    value={followUpInput}
                    onChange={e => setFollowUpInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleFollowUp(followUpInput)}
                    placeholder="Ask a follow-up…"
                    className="flex-1 text-[13px] bg-transparent outline-none min-w-0"
                    style={{ color: textMain }}
                    disabled={isFollowingUp || isLoading}
                  />
                </div>
                <button
                  onClick={() => handleFollowUp(followUpInput)}
                  disabled={!followUpInput.trim() || isFollowingUp || isLoading}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-all disabled:opacity-40 shrink-0"
                  style={{ background: '#00C4FF', color: '#fff' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#0060df'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#00C4FF'; }}>
                  {isFollowingUp
                    ? <><RefreshCw size={11} className="animate-spin" /> thinking…</>
                    : <><Send size={11} /> Follow up</>}
                </button>
              </div>
            )}

            <div className="h-4" />
            </>
            )}

          </div>
        </div>

        {/* ── Floating bottom query bar ── */}
        {topTab === 'intelligence' && (
          <div className="shrink-0 z-20 px-4 md:px-8 pb-6 pt-2 pointer-events-none">
            <div className="pointer-events-auto max-w-[920px] mx-auto w-full">
              {attachedImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2 px-1">
                  {attachedImages.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img.dataUrl} alt={img.name} className="h-10 w-10 object-cover rounded-lg" style={{ border: 'none', boxShadow: neuExtrudedSm }} />
                      <button onClick={() => setAttachedImages(prev => prev.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: isDark ? '#333' : '#666', color: '#fff' }}>
                        <X size={9} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                className="query-bar-glow query-bar-float relative flex items-end w-full"
                style={{ background: headerBg }}
              >
                <Search size={15} className="absolute left-4 top-4 pointer-events-none" style={{ color: textSubtle }} />
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={e => { setInputValue(e.target.value); autoResizeTextarea(); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(inputValue);
                    }
                  }}
                  placeholder="Ask a growth intelligence question…"
                  className="query-textarea w-full pl-11 pr-[96px] py-3.5 bg-transparent outline-none font-sans"
                  style={{ color: textMain }}
                  disabled={isLoading}
                  rows={1}
                />
                <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
                  <button onClick={() => fileInputRef.current?.click()}
                    className="neu-extruded-sm w-9 h-9 flex items-center justify-center rounded-xl"
                    style={{ color: textSubtle }}
                    aria-label="Attach image">
                    <Paperclip size={14} />
                  </button>
                  <button
                    onClick={() => handleSend(inputValue)}
                    disabled={(!inputValue.trim() && attachedImages.length === 0) || isLoading}
                    className="bg-gradient-signature flex items-center justify-center w-9 h-9 rounded-lg text-[13px] font-medium disabled:opacity-35"
                  >
                    {isLoading
                      ? <RefreshCw size={14} className="animate-spin" />
                      : <Send size={14} />}
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
