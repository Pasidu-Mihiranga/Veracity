import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
} from '@react-pdf/renderer';
import type { ExecutiveReportData } from '@/lib/export/build-report-data';

const colors = {
  ink: '#0B1A2E',
  muted: '#5B6B7C',
  line: '#D8DEE6',
  accent: '#0A7EA4',
  soft: '#F4F7FA',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: colors.ink,
  },
  brand: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  eyebrow: {
    marginTop: 4,
    fontSize: 8,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  metaRow: {
    marginTop: 16,
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaText: {
    fontSize: 9,
    color: colors.muted,
    maxWidth: '48%',
  },
  h2: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 8,
    marginTop: 16,
    color: colors.ink,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.45,
    color: colors.ink,
  },
  card: {
    backgroundColor: colors.soft,
    padding: 10,
    marginBottom: 6,
    borderRadius: 4,
  },
  cardTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    marginBottom: 3,
  },
  cardMeta: {
    fontSize: 8,
    color: colors.muted,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.ink,
    color: '#fff',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  colFeature: { width: '34%' },
  colSmall: { width: '22%' },
  sourceRow: {
    marginBottom: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  link: {
    color: colors.accent,
    textDecoration: 'none',
    fontSize: 9,
  },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: colors.muted,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  branch: {
    marginBottom: 6,
  },
  branchChild: {
    marginLeft: 10,
    color: colors.muted,
    fontSize: 9,
    marginTop: 2,
  },
});

type Props = { data: ExecutiveReportData };

export function ExecutivePdfDocument({ data }: Props) {
  const dateLabel = (() => {
    const t = Date.parse(data.generatedAt);
    if (Number.isNaN(t)) return data.generatedAt;
    return new Date(t).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  })();

  return (
    <Document
      title={`${data.product} — Executive Intelligence Report`}
      author="Veracity"
      subject={data.query || 'Competitive intelligence sweep'}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.brand}>Veracity</Text>
        <Text style={styles.eyebrow}>Executive intelligence report</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            Product: {data.product}
            {data.competitor ? `\nCompetitor: ${data.competitor}` : ''}
            {data.confidence ? `\nConfidence: ${data.confidence}` : ''}
          </Text>
          <Text style={styles.metaText}>
            Generated: {dateLabel}
            {data.query ? `\nQuery: ${data.query}` : ''}
          </Text>
        </View>

        <Text style={styles.h2}>Executive summary</Text>
        <Text style={styles.body}>{data.summary || 'No summary available for this sweep.'}</Text>

        {data.recommendations.length > 0 && (
          <>
            <Text style={styles.h2}>Strategic recommendations</Text>
            {data.recommendations.map((rec, i) => (
              <View key={`${rec.title}-${i}`} style={styles.card} wrap={false}>
                <Text style={styles.cardMeta}>
                  {rec.priority} · {rec.confidence}
                </Text>
                <Text style={styles.cardTitle}>{rec.title}</Text>
                <Text style={styles.body}>{rec.rationale}</Text>
              </View>
            ))}
          </>
        )}

        {data.domainHighlights.length > 0 && (
          <>
            <Text style={styles.h2}>Domain highlights</Text>
            {data.domainHighlights.map((h, i) => (
              <View key={`${h.domain}-${i}`} style={styles.card} wrap={false}>
                <Text style={styles.cardMeta}>
                  {h.domain} · {h.confidence}
                </Text>
                <Text style={styles.body}>{h.highlight}</Text>
              </View>
            ))}
          </>
        )}

        {data.matrix.length > 0 && (
          <>
            <Text style={styles.h2}>
              Competitive matrix{data.matrixCompetitor ? ` vs ${data.matrixCompetitor}` : ''}
            </Text>
            <View style={styles.tableHeader}>
              <Text style={styles.colFeature}>Feature</Text>
              <Text style={styles.colSmall}>Yours</Text>
              <Text style={styles.colSmall}>Competitor</Text>
              <Text style={styles.colSmall}>Gap</Text>
            </View>
            {data.matrix.map((row, i) => (
              <View key={`${row.feature}-${i}`} style={styles.tableRow} wrap={false}>
                <Text style={styles.colFeature}>{row.feature}</Text>
                <Text style={styles.colSmall}>{row.yours}</Text>
                <Text style={styles.colSmall}>{row.competitor}</Text>
                <Text style={styles.colSmall}>{row.gap}</Text>
              </View>
            ))}
          </>
        )}

        {data.mindMap && (
          <>
            <Text style={styles.h2}>Mind map — {data.mindMap.centralTopic}</Text>
            {data.mindMap.summary ? (
              <Text style={[styles.body, { marginBottom: 8 }]}>{data.mindMap.summary}</Text>
            ) : null}
            {data.mindMap.branches.map((b, i) => (
              <View key={`${b.label}-${i}`} style={styles.branch} wrap={false}>
                <Text style={styles.cardTitle}>{b.label}</Text>
                {b.children.map((c, ci) => (
                  <Text key={`${c}-${ci}`} style={styles.branchChild}>{c}</Text>
                ))}
              </View>
            ))}
          </>
        )}

        {data.sources.length > 0 && (
          <>
            <Text style={styles.h2}>Sources</Text>
            {data.sources.map((s, i) => (
              <View key={`${s.url}-${i}`} style={styles.sourceRow} wrap={false}>
                <Text>
                  {i + 1}. {s.title}
                  {s.tool ? ` (${s.tool})` : ''} —{' '}
                </Text>
                <Link src={s.url} style={styles.link}>
                  {s.url}
                </Link>
              </View>
            ))}
          </>
        )}

        <View style={styles.footer} fixed>
          <Text>Veracity · Confidential</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
