'use client';

import React, { useState } from 'react';
import { Download, Info } from 'lucide-react';
import { downloadCsv, rowsToCsv } from '@/lib/csv-download';
import type { AgentOutput } from '@/lib/agents/types';

/**
 * The methodology contract, for artifacts that are not time series.
 *
 * `ChartSpecView` carries this for anything with a period and a numeric axis.
 * But a competitive matrix, a win/loss scorecard, and a positioning gap table
 * are not series — forcing them through a chart spec would mean inventing a
 * period and a unit they do not have, which is exactly the kind of fabrication
 * the spec exists to prevent.
 *
 * What they *do* share is the obligation: say where this came from, what class
 * of claim it is, how fresh it is, and let the user take the underlying rows
 * away. That obligation is what this component carries.
 *
 * Data class defaults to `derived` rather than `observed`. Most of these
 * artifacts are model-structured judgments over retrieved text, and a
 * conservative default means a genuinely observed artifact has to say so
 * explicitly rather than an unlabelled one being read as measured.
 */

export interface ArtifactMethodologyProps {
  /** The agent output behind this artifact. */
  output: Pick<AgentOutput, 'sources' | 'generatedAt' | 'confidence' | 'dataClass'>;
  /** How this artifact was produced, in the user's language. */
  method: string;
  /** What it cannot tell you. */
  limitations?: string[];
  /** Rows for CSV export, with their header. Omit to hide the download. */
  csv?: { filename: string; headers: string[]; rows: Array<Array<string | number>> };
}

const DATA_CLASS_STYLE: Record<string, string> = {
  observed: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 border-emerald-500/30 font-semibold',
  derived: 'bg-blue-500/10 text-blue-900 dark:text-blue-300 border-blue-500/30 font-semibold',
  synthetic: 'bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-500/30 font-semibold',
};

const DATA_CLASS_NOTE: Record<string, string> = {
  observed: 'Read directly from the cited sources.',
  derived: 'Structured by the model from retrieved text. The structure is analysis, not measurement.',
  synthetic: 'Model-generated scenario output. Not observed evidence.',
};

export function ArtifactMethodology({
  output,
  method,
  limitations = [],
  csv,
}: ArtifactMethodologyProps) {
  const [open, setOpen] = useState(false);

  const dataClass = output.dataClass ?? 'derived';
  const sources = output.sources ?? [];

  const download = () => {
    if (!csv) return;
    downloadCsv(csv.filename, rowsToCsv(csv.headers, csv.rows));
  };

  return (
    <div className="flex flex-col gap-2 pt-3 mt-1 border-t border-border">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${DATA_CLASS_STYLE[dataClass] ?? DATA_CLASS_STYLE.derived}`}
        >
          {dataClass}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {sources.length} source{sources.length === 1 ? '' : 's'}
        </span>
        <span className="text-[10px] font-mono text-muted-foreground">
          {new Date(output.generatedAt).toLocaleString()}
        </span>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="text-[10px] font-mono text-accent hover:opacity-80 inline-flex items-center gap-1"
        >
          <Info size={11} /> Method
        </button>

        {csv && csv.rows.length > 0 ? (
          <button
            type="button"
            onClick={download}
            className="text-[10px] font-mono text-accent hover:opacity-80 inline-flex items-center gap-1"
          >
            <Download size={11} /> CSV
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="flex flex-col gap-2.5 text-xs text-muted-foreground">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider">How this was built</span>
            <span>{method}</span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider">Class</span>
            <span>{DATA_CLASS_NOTE[dataClass] ?? DATA_CLASS_NOTE.derived}</span>
          </div>

          {limitations.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider">Limitations</span>
              <ul className="flex flex-col gap-1 list-none p-0 m-0">
                {limitations.map((limitation, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5">–</span>
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {sources.length > 0 ? (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider">Sources</span>
              <ul className="flex flex-col gap-0.5 list-none p-0 m-0">
                {sources.slice(0, 8).map((source, i) => (
                  <li key={i}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline break-all"
                    >
                      {source.title || source.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            // Said plainly. An artifact with no sources is a judgment, and the
            // user should be able to see that at a glance.
            <span className="text-amber-700">
              No sources were recorded for this artifact.
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
