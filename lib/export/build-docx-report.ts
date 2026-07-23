import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ExternalHyperlink,
  AlignmentType,
} from 'docx';
import type { ExecutiveReportData } from '@/lib/export/build-report-data';

function bar(score: number): string {
  const filled = Math.round(Math.max(0, Math.min(1, score)) * 10);
  return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
}

/**
 * Build a DOCX blob mirroring the executive PDF sections.
 */
export async function buildDocxBlob(data: ExecutiveReportData): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({
      text: 'Veracity',
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Executive intelligence report',
          italics: true,
          size: 20,
          color: '64748B',
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: `Product: ${data.product}${data.competitor ? ` · Competitor: ${data.competitor}` : ''}${data.confidence ? ` · Confidence: ${data.confidence}` : ''}`,
          size: 18,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${data.generatedAt.slice(0, 10)}${data.query ? ` · Query: ${data.query}` : ''}`,
          size: 18,
          color: '64748B',
        }),
      ],
    }),
    new Paragraph({
      text: 'Executive decision',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 320 },
    }),
    new Paragraph({
      children: [new TextRun({ text: data.summary || 'No summary available.', size: 22 })],
    }),
  ];

  if (data.evidenceCoverage?.length) {
    children.push(
      new Paragraph({
        text: 'Evidence coverage',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280 },
      }),
    );
    for (const axis of data.evidenceCoverage) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${axis.label.padEnd(14)} ${bar(axis.score)}  ${Math.round(axis.score * 100)}% · ${axis.sourceCount} src`,
              font: 'Courier New',
              size: 18,
            }),
          ],
        }),
      );
    }
  }

  if (data.recommendations.length) {
    children.push(
      new Paragraph({
        text: 'Strategic recommendations',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280 },
      }),
    );
    for (const rec of data.recommendations) {
      children.push(
        new Paragraph({
          spacing: { before: 160 },
          children: [
            new TextRun({
              text: `${rec.priority} · ${rec.confidence}`,
              size: 16,
              color: '64748B',
              allCaps: true,
            }),
          ],
        }),
        new Paragraph({
          children: [new TextRun({ text: rec.title, bold: true, size: 22 })],
        }),
        new Paragraph({
          children: [new TextRun({ text: rec.rationale, size: 20 })],
        }),
      );
      for (const url of rec.sourceUrls ?? []) {
        children.push(
          new Paragraph({
            children: [
              new ExternalHyperlink({
                children: [new TextRun({ text: url, style: 'Hyperlink', size: 16 })],
                link: url,
              }),
            ],
          }),
        );
      }
    }
  }

  if (data.matrix.length) {
    children.push(
      new Paragraph({
        text: `Competitive matrix${data.matrixCompetitor ? ` vs ${data.matrixCompetitor}` : ''}`,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280 },
      }),
    );
    for (const row of data.matrix) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${row.feature}: yours=${row.yours}, competitor=${row.competitor}, gap=${row.gap}`,
              size: 18,
            }),
          ],
        }),
      );
    }
  }

  if (data.sources.length) {
    children.push(
      new Paragraph({
        text: 'Sources',
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 280 },
      }),
    );
    data.sources.forEach((s, i) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${i + 1}. ${s.title} — `, size: 18 }),
            new ExternalHyperlink({
              children: [new TextRun({ text: s.url, style: 'Hyperlink', size: 16 })],
              link: s.url,
            }),
          ],
        }),
      );
    });
  }

  children.push(
    new Paragraph({
      spacing: { before: 400 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Veracity · Confidential', size: 16, color: '94A3B8' }),
      ],
    }),
  );

  const doc = new Document({
    sections: [{ children }],
  });

  return Packer.toBlob(doc);
}

export function docxFilename(data: ExecutiveReportData): string {
  const slug = (data.product || 'veracity')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const day = data.generatedAt.slice(0, 10);
  return `${slug || 'veracity'}-executive-report-${day}.docx`;
}
