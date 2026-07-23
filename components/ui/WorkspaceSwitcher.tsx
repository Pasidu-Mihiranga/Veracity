'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Check, ChevronDown, Plus, Users } from 'lucide-react';
import { featureFlags } from '@/lib/feature-flags';

type Workspace = {
  id: string;
  name: string;
  slug: string;
  role?: string;
  industry?: string | null;
};

type Props = {
  onOpenMembers?: () => void;
  accentInk: string;
  textMuted: string;
};

export function WorkspaceSwitcher({ onOpenMembers, accentInk, textMuted }: Props) {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    if (!featureFlags.workspaces) return;
    const res = await fetch('/api/workspaces', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    setWorkspaces(data.workspaces ?? []);
    setActiveId(data.activeWorkspaceId ?? null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!featureFlags.workspaces) return null;

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];

  const activate = async (id: string) => {
    await fetch(`/api/workspaces/${id}`, {
      method: 'PUT',
      credentials: 'include',
    });
    setActiveId(id);
    setOpen(false);
    window.location.reload();
  };

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        setName('');
        window.location.reload();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="neu-pill flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono max-w-[10rem]"
        style={{ color: accentInk }}
        title="Workspace"
      >
        <Building2 size={12} />
        <span className="truncate">{active?.name ?? 'Workspace'}</span>
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 veracity-card p-2 shadow-lg">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-2 py-1">
            Workspaces
          </div>
          <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {workspaces.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => void activate(w.id)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs hover:bg-muted"
              >
                {w.id === activeId ? <Check size={12} className="text-accent" /> : <span className="w-3" />}
                <span className="truncate flex-1">{w.name}</span>
                {w.role && (
                  <span className="font-mono text-[9px] text-muted-foreground uppercase">{w.role}</span>
                )}
              </button>
            ))}
          </div>
          <div className="border-t border-border mt-2 pt-2 flex flex-col gap-1.5">
            <div className="flex gap-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="New workspace"
                className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-border bg-background"
              />
              <button
                type="button"
                disabled={creating}
                onClick={() => void create()}
                className="bg-gradient-signature text-white rounded-lg px-2 py-1.5"
              >
                <Plus size={14} />
              </button>
            </div>
            {featureFlags.rbac && onOpenMembers && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenMembers();
                }}
                className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-1.5 rounded-lg hover:bg-muted"
                style={{ color: textMuted }}
              >
                <Users size={12} /> Members &amp; invites
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
