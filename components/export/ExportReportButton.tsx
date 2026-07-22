'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
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

export function ExportReportButton({
  message,
  variant = 'primary',
}: Props) {
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    if (busy) return;
    setBusy(true);
    trackEvent('export_pdf_click', {
      sessionMessageId: message.persistedId ?? message.id,
      hasOrchestrator: Boolean(message.orchestratorOutput),
    });
    try {
      const data = buildExecutiveReport(message);
      const [{ pdf }, { ExecutivePdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/export/ExecutivePdfDocument'),
      ]);
      const blob = await pdf(<ExecutivePdfDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = reportFilename(data);
      a.click();
      URL.revokeObjectURL(url);
      trackEvent('export_pdf_success', {
        product: data.product,
        sources: data.sources.length,
      });
    } catch (err) {
      trackEvent('export_pdf_error', {
        message: err instanceof Error ? err.message : 'unknown',
      });
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || !message.content;

  return (
    <button
      type="button"
      onClick={() => {
        void onExport();
      }}
      disabled={disabled}
      title="Download executive PDF with visuals and sources"
      className={
        variant === 'primary'
          ? 'bg-gradient-signature inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[14px] font-semibold font-sans disabled:opacity-50 min-h-11'
          : 'inline-flex items-center gap-2 text-[12px] font-semibold font-sans px-3.5 py-2 rounded-xl transition-opacity disabled:opacity-50'
      }
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
      {busy ? <Loader2 size={variant === 'primary' ? 16 : 14} className="animate-spin" /> : <Download size={variant === 'primary' ? 16 : 14} />}
      {busy ? 'Preparing PDF…' : variant === 'primary' ? 'Export PDF report' : 'Export PDF'}
    </button>
  );
}
