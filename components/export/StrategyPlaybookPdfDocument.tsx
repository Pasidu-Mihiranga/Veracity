import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { GrowthPlaybookResult, CompanyTimelineMilestone } from '@/app/api/steal-strategy/route';

const colors = {
  ink: '#0F172A',
  muted: '#475569',
  subtle: '#64748B',
  line: '#E2E8F0',
  accent: '#2A78D6',
  accentDark: '#1E40AF',
  soft: '#F8FAFC',
  cardBg: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: colors.ink,
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.accent,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  brand: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: colors.accent,
    letterSpacing: 0.5,
  },
  badge: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginTop: 2,
    marginBottom: 4,
  },
  metaGrid: {
    flexDirection: 'row',
    backgroundColor: colors.soft,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 8,
    marginBottom: 14,
    justifyContent: 'space-between',
  },
  metaCol: {
    width: '32%',
  },
  metaLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: colors.subtle,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  metaVal: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  sectionHeading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.accentDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  summaryBox: {
    backgroundColor: colors.soft,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 9.5,
    color: colors.ink,
    lineHeight: 1.45,
  },
  breakthroughBox: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#93C5FD',
    marginBottom: 12,
  },
  breakthroughTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: colors.accentDark,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  breakthroughText: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
  },
  milestoneCard: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: colors.soft,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.line,
  },
  milestoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  milestoneStepTag: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.accentDark,
    textTransform: 'uppercase',
  },
  milestoneTime: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.muted,
  },
  milestoneTitle: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: colors.ink,
    marginBottom: 2,
  },
  milestoneDesc: {
    fontSize: 8.5,
    color: colors.muted,
    lineHeight: 1.35,
  },
  treePhaseCard: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
  },
  treePhaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  treeBranch: {
    marginLeft: 10,
    paddingLeft: 8,
    borderLeftWidth: 1.5,
    borderLeftColor: colors.accent,
    marginBottom: 6,
  },
  branchTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.accentDark,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  branchItem: {
    fontSize: 8.5,
    color: colors.ink,
    marginBottom: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 6,
    fontSize: 7.5,
    color: colors.subtle,
  },
});

export function StrategyPlaybookPdfDocument({ data }: { data: GrowthPlaybookResult }) {
  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>VERACITY AI</Text>
            <Text style={styles.badge}>Executive Growth Strategy Report</Text>
          </View>
          <Text style={styles.title}>{data.company} Strategic Growth Playbook</Text>
        </View>

        {/* Profile Meta Grid */}
        <View style={styles.metaGrid}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Industry / Field</Text>
            <Text style={styles.metaVal}>{data.market}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Current Stage</Text>
            <Text style={styles.metaVal}>{data.stage}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Primary Goal</Text>
            <Text style={styles.metaVal}>{data.goal}</Text>
          </View>
        </View>

        {/* Executive Summary */}
        <Text style={styles.sectionHeading}>Executive Summary</Text>
        <View style={styles.summaryBox}>
          <Text style={styles.bodyText}>{data.summary}</Text>
        </View>

        {/* The #1 Breakthrough Move */}
        {data.evolutionStages?.breakthroughMove ? (
          <View style={styles.breakthroughBox}>
            <Text style={styles.breakthroughTitle}>The #1 Breakthrough Move</Text>
            <Text style={styles.breakthroughText}>{data.evolutionStages.breakthroughMove}</Text>
          </View>
        ) : null}

        {/* Core Success Principle */}
        {data.ethicalGuardrails ? (
          <View style={{ marginBottom: 12, padding: 8, backgroundColor: colors.soft, borderRadius: 5 }}>
            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: colors.subtle, textTransform: 'uppercase', marginBottom: 2 }}>
              Core Success Principle
            </Text>
            <Text style={{ fontSize: 8.5, color: colors.ink }}>{data.ethicalGuardrails}</Text>
          </View>
        ) : null}

        {/* Company History & Milestones */}
        <Text style={styles.sectionHeading}>Evolution & Growth Milestones of {data.company}</Text>
        <View style={{ marginBottom: 8 }}>
          {(data.companyMilestones || []).map((m: CompanyTimelineMilestone, i: number) => (
            <View key={i} style={styles.milestoneCard}>
              <View style={styles.milestoneHeader}>
                <Text style={styles.milestoneStepTag}>
                  Step {m.stepNumber || i + 1} · {m.categoryTag}
                </Text>
                <Text style={styles.milestoneTime}>{m.yearOrTimeframe}</Text>
              </View>
              <Text style={styles.milestoneTitle}>{m.title}</Text>
              <Text style={styles.milestoneDesc}>{m.description}</Text>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Veracity Strategic Intelligence · Confidential</Text>
          <Text>Generated on {formattedDate}</Text>
        </View>
      </Page>

      {/* Page 2: Step-by-Step Tree Roadmap & Recommendations */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Text style={styles.brand}>VERACITY AI</Text>
            <Text style={styles.badge}>{data.company} Step-by-Step Tree Roadmap</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Step-by-Step Execution Roadmap (Tree Structure)</Text>
        {data.executionTimeline.map((phase) => (
          <View key={phase.id || phase.phase} style={styles.treePhaseCard}>
            <View style={styles.treePhaseHeader}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.accentDark }}>
                {phase.phase} · {phase.timeframe}
              </Text>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: colors.ink }}>
                {phase.title}
              </Text>
            </View>

            {/* Core Goals Branch */}
            {phase.objectives && phase.objectives.length > 0 && (
              <View style={styles.treeBranch}>
                <Text style={styles.branchTitle}>Core Objectives</Text>
                {phase.objectives.map((obj, oIdx) => (
                  <Text key={oIdx} style={styles.branchItem}>• {obj}</Text>
                ))}
              </View>
            )}

            {/* Deliverables Branch */}
            <View style={styles.treeBranch}>
              <Text style={styles.branchTitle}>Key Deliverables</Text>
              {(phase.deliverables || []).map((del) => (
                <Text key={del.id} style={styles.branchItem}>• {del.text}</Text>
              ))}
            </View>

            {/* Weekly Actions Branch */}
            <View style={styles.treeBranch}>
              <Text style={styles.branchTitle}>Strategic Action Steps</Text>
              {(phase.weeklyActions || []).map((act) => (
                <Text key={act.id} style={styles.branchItem}>• {act.text}</Text>
              ))}
            </View>
          </View>
        ))}

        {/* Growth Recommendations */}
        <Text style={styles.sectionHeading}>Key Recommendations & Growth Levers</Text>
        {data.growthLevers.map((lever, lIdx) => (
          <View key={lIdx} style={{ marginBottom: 6, padding: 8, backgroundColor: colors.soft, borderRadius: 5 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: colors.ink, marginBottom: 2 }}>
              {lever.leverName}
            </Text>
            <Text style={{ fontSize: 8.5, color: colors.muted, marginBottom: 3 }}>
              {lever.howToApplyNow}
            </Text>
            {lever.actionableTactics.map((tac, tIdx) => (
              <Text key={tIdx} style={{ fontSize: 8, color: colors.ink }}>• {tac}</Text>
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Veracity Strategic Intelligence · Confidential</Text>
          <Text>Page 2</Text>
        </View>
      </Page>
    </Document>
  );
}
