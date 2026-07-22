'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { ChatMessage } from '@/types/chat-ui';
import { trackEvent } from '@/lib/analytics';
import { buildExecutiveReport, reportFilename } from '@/lib/export/build-report-data';

type Props = {
  message: ChatMessage;
  accentInk: string;
  textSubtle: string;
  cardBg2: string;
  neuExtrudedSm: string;
};

export function ExportReportButton({
  message,
  accentInk,
  textSubtle,
  cardBg2,
  neuExtrudedSm,
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

  return (
    <button
      type="button"
      onClick={() => { void onExport(); }}
      disabled={busy || !message.content}
      title="Download executive PDF"
      className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded transition-opacity disabled:opacity-50"
      style={{
        color: accentInk,
        background: cardBg2,
        boxShadow: neuExtrudedSm,
        border: 'none',
      }}
    >
      {busy ? (
        <Loader2 size={12} className="animate-spin" style={{ color: textSubtle }} />
      ) : (
        <Download size={12} />
      )}
      {busy ? 'Exporting…' : 'Export PDF'}
    </button>
  );
}
