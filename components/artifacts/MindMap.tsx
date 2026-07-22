'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, BookOpen, ExternalLink } from 'lucide-react';
import type { MindMapOutput, MindMapNode, ConfidenceLevel } from '@/lib/agents/types';
import { useTheme } from '@/lib/theme-provider';

interface Props {
  output: MindMapOutput;
}

const PILLAR_ACCENTS = [
  '#00C4FF',
  '#3D9EFF',
  '#7DD3FC',
  '#38BDF8',
  '#60A5FA',
  '#A5B4FC',
  '#22D3EE',
  '#93C5FD',
];

const CONF_LABEL: Record<ConfidenceLevel, string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
};

function isValidNode(n: MindMapNode): boolean {
  return !!(n.label && n.label.trim().length > 1);
}

function filterBranches(branches: MindMapNode[]): MindMapNode[] {
  return branches.filter(isValidNode).map((b) => ({
    ...b,
    children: b.children
      ? b.children.filter(isValidNode).map((c) => ({
          ...c,
          children: c.children ? c.children.filter(isValidNode) : undefined,
        }))
      : undefined,
  }));
}

function ChildRow({
  node,
  accent,
  textMuted,
  depth = 0,
}: {
  node: MindMapNode;
  accent: string;
  textMuted: string;
  depth?: number;
}) {
  return (
    <div style={{ marginLeft: depth * 12 }}>
      <div className="flex items-start gap-2 py-1.5">
        <span
          className="mt-1.5 shrink-0 rounded-full"
          style={{ width: 6, height: 6, background: accent, opacity: depth === 0 ? 1 : 0.55 }}
        />
        <div className="min-w-0 flex-1">
          <p className="ui-body-sm font-medium" style={{ color: 'var(--foreground)' }}>
            {node.label}
          </p>
          {node.detail ? (
            <p className="ui-caption mt-0.5" style={{ color: textMuted }}>
              {node.detail}
            </p>
          ) : null}
        </div>
      </div>
      {(node.children ?? []).slice(0, 4).map((child, i) => (
        <ChildRow
          key={child.id || `${node.id}-c-${i}`}
          node={child}
          accent={accent}
          textMuted={textMuted}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function PillarCard({
  branch,
  index,
  open,
  onToggle,
  isDark,
  textMuted,
  textSubtle,
}: {
  branch: MindMapNode;
  index: number;
  open: boolean;
  onToggle: () => void;
  isDark: boolean;
  textMuted: string;
  textSubtle: string;
}) {
  const accent = PILLAR_ACCENTS[index % PILLAR_ACCENTS.length];
  const children = (branch.children ?? []).slice(0, 6);

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: isDark ? 'rgba(15,26,40,0.85)' : 'rgba(255,255,255,0.55)',
        border: `1px solid ${isDark ? 'rgba(168,192,216,0.14)' : 'rgba(26,53,84,0.12)'}`,
        boxShadow: `inset 3px 0 0 0 ${accent}`,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors"
        style={{ background: open ? (isDark ? 'rgba(0,196,255,0.06)' : 'rgba(0,82,163,0.04)') : 'transparent' }}
      >
        <span
          className="ui-mono shrink-0 mt-0.5 w-6 h-6 rounded-lg flex items-center justify-center"
          style={{
            background: isDark ? 'rgba(0,196,255,0.12)' : 'rgba(0,82,163,0.1)',
            color: accent,
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="ui-title">{branch.label}</h4>
            {branch.confidence ? (
              <span className="ui-mono" style={{ color: textSubtle, fontSize: 10 }}>
                {CONF_LABEL[branch.confidence]}
              </span>
            ) : null}
          </div>
          {branch.detail ? (
            <p className="ui-caption mt-1" style={{ color: textMuted }}>
              {branch.detail}
            </p>
          ) : null}
          {!open && children.length > 0 ? (
            <p className="ui-mono mt-1.5" style={{ color: textSubtle, fontSize: 10 }}>
              {children.length} action{children.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
        <ChevronDown
          size={16}
          className="shrink-0 mt-1 transition-transform"
          style={{
            color: textSubtle,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && children.length > 0 ? (
        <div
          className="px-4 pb-4 pt-1"
          style={{ borderTop: `1px solid ${isDark ? 'rgba(168,192,216,0.1)' : 'rgba(26,53,84,0.08)'}` }}
        >
          {children.map((child, i) => (
            <ChildRow
              key={child.id || `${branch.id}-${i}`}
              node={child}
              accent={accent}
              textMuted={textMuted}
            />
          ))}
        </div>
      ) : null}

      {open && children.length === 0 && branch.detail ? null : null}
    </div>
  );
}

/**
 * Strategy pillars — readable dark-mode alternative to radial mind maps.
 * Same MindMapOutput data; denser hierarchy, no pan/zoom empty canvas.
 */
export function MindMap({ output }: Props) {
  const { isDark, textMuted, textSubtle } = useTheme();
  const centralTopic = output.centralTopic ?? '';
  const summary = output.summary;
  const sources = output.sources ?? [];
  const branches = useMemo(() => filterBranches(output.branches ?? []), [output.branches]);

  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(branches.slice(0, 3).map((b) => b.id)));
  const [showSources, setShowSources] = useState(false);

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (branches.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed p-4 ui-body-sm"
        style={{ color: textMuted, borderColor: 'var(--border)' }}
      >
        Synthesis returned no usable strategy pillars for this query.
        {summary ? <span className="block mt-1" style={{ color: 'var(--foreground)' }}>{summary}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          {centralTopic ? <h3 className="ui-heading">{centralTopic}</h3> : null}
        </div>
        <button
          type="button"
          className="ui-mono text-[10px] px-2.5 py-1 rounded-lg"
          style={{
            color: textSubtle,
            background: isDark ? 'rgba(15,26,40,0.9)' : 'rgba(214,228,240,0.8)',
            border: '1px solid var(--border)',
          }}
          onClick={() => {
            if (openIds.size >= branches.length) setOpenIds(new Set());
            else setOpenIds(new Set(branches.map((b) => b.id)));
          }}
        >
          {openIds.size >= branches.length ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {summary ? (
        <p className="ui-body" style={{ color: textMuted }}>
          {summary}
        </p>
      ) : null}

      <div className="flex flex-col gap-2.5">
        {branches.map((branch, i) => (
          <PillarCard
            key={branch.id || `pillar-${i}`}
            branch={branch}
            index={i}
            open={openIds.has(branch.id)}
            onToggle={() => toggle(branch.id)}
            isDark={isDark}
            textMuted={textMuted}
            textSubtle={textSubtle}
          />
        ))}
      </div>

      {sources.length > 0 ? (
        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowSources((v) => !v)}
            className="flex items-center gap-1.5 ui-section-label w-fit"
            style={{ color: textSubtle }}
          >
            <BookOpen size={11} />
            {sources.length} source{sources.length !== 1 ? 's' : ''}
            <ChevronDown
              size={10}
              className="transition-transform"
              style={{ transform: showSources ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
          {showSources ? (
            <div className="flex flex-wrap gap-1.5">
              {sources.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-chip max-w-[220px]"
                >
                  <ExternalLink size={9} className="shrink-0" />
                  <span className="truncate">{src.title || src.url}</span>
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
