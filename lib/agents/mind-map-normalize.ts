import type { MindMapNode } from './types';

const MAX_BRANCHES = 5;
const MAX_CHILDREN = 3;
const MAX_GRANDCHILDREN = 2;
const MAX_BRANCH_WORDS = 5;
const MAX_LEAF_WORDS = 7;
const MAX_CENTER_WORDS = 6;

function clampWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return `${words.slice(0, maxWords).join(' ')}…`;
}

function cleanLabel(label: unknown, maxWords: number): string {
  if (typeof label !== 'string') return 'Insight';
  const cleaned = label.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Insight';
  return clampWords(cleaned, maxWords);
}

function normalizeNode(node: MindMapNode, depth: number): MindMapNode | null {
  const maxWords = depth <= 1 ? MAX_BRANCH_WORDS : MAX_LEAF_WORDS;
  const label = cleanLabel(node.label, maxWords);
  if (label.length < 2) return null;

  const detail = typeof node.detail === 'string' && node.detail.trim()
    ? node.detail.trim()
    : label;

  let children = (node.children ?? [])
    .map((c) => normalizeNode(c, depth + 1))
    .filter((c): c is MindMapNode => Boolean(c));

  if (depth === 1) children = children.slice(0, MAX_CHILDREN);
  if (depth === 2) children = children.slice(0, MAX_GRANDCHILDREN);
  if (depth >= 3) children = [];

  return {
    ...node,
    id: node.id || `node-${depth}-${label.slice(0, 12)}`,
    label,
    detail,
    children: children.length ? children : undefined,
  };
}

/**
 * Enforce executive mind-map hygiene: short labels, max 5 pillars,
 * no hub/branch title collision, capped depth.
 */
export function normalizeMindMapTree(input: {
  centralTopic?: unknown;
  summary?: unknown;
  branches?: unknown;
  product?: string;
  query?: string;
}): { centralTopic: string; summary: string; branches: MindMapNode[] } {
  const query = (input.query || '').trim();
  const product = (input.product || '').trim();
  let centralTopic = cleanLabel(
    input.centralTopic || query || product || 'Strategy map',
    MAX_CENTER_WORDS,
  );

  const rawBranches = Array.isArray(input.branches) ? (input.branches as MindMapNode[]) : [];
  let branches = rawBranches
    .map((b) => normalizeNode(b, 1))
    .filter((b): b is MindMapNode => Boolean(b))
    .slice(0, MAX_BRANCHES);

  // Avoid hub repeating a branch title (common failure mode).
  const hubLower = centralTopic.toLowerCase().replace(/…$/, '');
  if (branches.some((b) => b.label.toLowerCase().replace(/…$/, '') === hubLower)) {
    centralTopic = cleanLabel(query || `${product} strategy` || 'Decision map', MAX_CENTER_WORDS);
  }

  // Drop duplicate branch labels
  const seen = new Set<string>();
  branches = branches.filter((b) => {
    const key = b.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const summary = typeof input.summary === 'string' && input.summary.trim()
    ? input.summary.trim().slice(0, 220)
    : `Strategic map for ${product || 'this product'} based on live intelligence.`;

  return { centralTopic, summary, branches };
}
