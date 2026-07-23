'use client';

import { useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import type { ChatMessage } from '@/types/chat-ui';
import { trackEvent } from '@/lib/analytics';
import { buildExecutiveReport, reportFilename } from '@/lib/export/build-report-data';

type Props = {
  message: ChatMessage;
  /** @deprecated kept for call-site compat; colors come from CSS theme vars */
  accentInk?: string;
  textSubtle?: string;
  cardBg2?: string;
  neuExtrudedSm?: string;
  variant?: 'header' | 'primary';
};

type Format = 'pdf' | 'docx';

export function ExportReportButton({
  message,
  variant = 'primary',
}: Props) {
  const [busy, setBusy] = useState<Format | null>(null);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onExport = async (format: Format) => {
    if (busy) return;
    setBusy(format);
    const eventBase = format === 'pdf' ? 'export_pdf' : 'export_docx';
    trackEvent(`${eventBase}_click`, {
      sessionMessageId: message.persistedId ?? message.id,
      hasOrchestrator: Boolean(message.orchestratorOutput),
    });
    try {
      const data = buildExecutiveReport(message);
      if (format === 'pdf') {
        const [{ pdf }, { ExecutivePdfDocument }] = await Promise.all([
          import('@react-pdf/renderer'),
          import('@/components/export/ExecutivePdfDocument'),
        ]);
        const blob = await pdf(<ExecutivePdfDocument data={data} />).toBlob();
        downloadBlob(blob, reportFilename(data));
      } else {
        const { buildDocxBlob, docxFilename } = await import('@/lib/export/build-docx-report');
        const blob = await buildDocxBlob(data);
        downloadBlob(blob, docxFilename(data));
      }
      trackEvent(`${eventBase}_success`, {
        product: data.product,
        sources: data.sources.length,
      });
    } catch (err) {
      trackEvent(`${eventBase}_error`, {
        message: err instanceof Error ? err.message : 'unknown',
      });
    } finally {
      setBusy(null);
    }
  };

  const disabled = Boolean(busy) || !message.content;
  const primaryClass =
    'bg-gradient-signature inline-flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-semibold font-sans disabled:opacity-50 min-h-11';
  const secondaryClass =
    'inline-flex items-center gap-2 text-[12px] font-semibold font-sans px-3.5 py-2 rounded-xl transition-opacity disabled:opacity-50 border border-accent/20 bg-accent/5 text-accent';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          void onExport('pdf');
        }}
        disabled={disabled}
        title="Download executive PDF"
        className={variant === 'primary' ? primaryClass : secondaryClass}
        style={
          variant === 'primary'
            ? undefined
            : {
                color: 'var(--accent)',
                background: 'var(--surface-raised)',
                boxShadow: 'var(--shadow-extruded-sm)',
                border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
              }
        }
      >
        {busy === 'pdf' ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Download size={14} />
        )}
        {busy === 'pdf' ? 'Preparing PDF…' : 'Export PDF'}
      </button>
      <button
        type="button"
        onClick={() => {
          void onExport('docx');
        }}
        disabled={disabled}
        title="Download executive DOCX"
        className={secondaryClass}
      >
        {busy === 'docx' ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <FileText size={14} />
        )}
        {busy === 'docx' ? 'Preparing DOCX…' : 'Export DOCX'}
      </button>
    </div>
  );
}
