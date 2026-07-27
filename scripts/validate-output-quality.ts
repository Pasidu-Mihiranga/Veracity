/**
 * Quality-output validation script (offline — no live LLM/search).
 *
 * Runs the same scenarios used to review anti-hallucination / entity grounding.
 *
 * Usage: npx tsx scripts/validate-output-quality.ts
 */
import { planQueries } from '../lib/tools/query-planner';
import {
  buildEntityTerms,
  filterSourcesByEntityRelevance,
} from '../lib/tools/source-relevance';
import {
  applyAbstainToArtifacts,
  applyOutputQualityGate,
  assessOutputQuality,
} from '../lib/agents/output-quality';
import type { AgentSource, CompetitiveOutput, MindMapOutput, Recommendation } from '../lib/agents/types';

type Check = { name: string; pass: boolean; detail: string };

const src = (title: string, url: string): AgentSource => ({
  title,
  url,
  timestamp: new Date().toISOString(),
  tool: 'serpapi',
});

const industrialRec: Recommendation = {
  title: 'Rebrand as Industrial Agent',
  rationale: 'Pivot into aerospace and missile manufacturing.',
  evidence: ['29.9% growth'],
  confidence: 'high',
  priority: 'immediate',
};

function check(name: string, pass: boolean, detail: string): Check {
  return { name, pass, detail };
}

function scenarioAmbiguousLilian(): Check[] {
  const sources = [
    src('Lillian Clay - Kelley School of Business', 'https://www.linkedin.com/in/lillian-clay'),
    src('Lilian Clay - Senior Consultation Officer', 'https://www.linkedin.com/in/lilian-clay-2'),
    src('Show HN: neumorphic CSS', 'https://news.ycombinator.com/item?id=2'),
    src('How I learned Python for AI', 'https://medium.com/python'),
    src('Micro SaaS Revolution: Quick 3-Minute Guide', 'https://example.com/micro-saas'),
  ];
  const report = assessOutputQuality({
    product: 'Lilian',
    competitor: 'Clay',
    sources,
    answer:
      'Rebrand as an Autonomous Industrial Agent for aerospace while also unifying property acquisition.',
    recommendations: [industrialRec],
    agentConfidenceAvg: 0.82,
  });
  const guarded = applyOutputQualityGate({
    product: 'Lilian',
    competitor: 'Clay',
    sources,
    answer: 'Immediate rebrand to industrial aerospace agent.',
    recommendations: [industrialRec],
    followUps: ['What next?'],
    agentConfidenceAvg: 0.82,
  });

  return [
    check(
      'Ambiguous Lilian → abstain',
      report.shouldAbstainFromStrongClaims === true,
      `abstain=${report.shouldAbstainFromStrongClaims}; flags=${report.flags.join(',')}`,
    ),
    check(
      'Ambiguous Lilian → person_homonym or thin evidence',
      report.flags.includes('person_homonym_noise') || report.flags.includes('thin_entity_evidence'),
      `flags=${report.flags.join(',')}`,
    ),
    check(
      'Ambiguous Lilian → contradiction flagged',
      report.flags.includes('contradictory_strategy_framing'),
      `flags=${report.flags.join(',')}`,
    ),
    check(
      'Ambiguous Lilian → evidence warning in answer',
      /Heads up:/i.test(guarded.answer),
      guarded.answer.slice(0, 120).replace(/\n/g, ' '),
    ),
    check(
      'Ambiguous Lilian → confidence lowered',
      guarded.totalConfidence === 'low',
      `confidence=${guarded.totalConfidence}; score=${guarded.confidenceScore.toFixed(2)}`,
    ),
    check(
      'Ambiguous Lilian → immediate → short-term',
      guarded.recommendations[0]?.priority === 'short-term',
      `priority=${guarded.recommendations[0]?.priority}`,
    ),
  ];
}

function scenarioClearProductSources(): Check[] {
  const sources = [
    src('Lilian AI SDR raises seed for GTM agents', 'https://techcrunch.com/lilian-ai'),
    src('Clay vs Lilian feature comparison', 'https://www.g2.com/compare/lilian-vs-clay'),
    src('Lilian pricing and seats', 'https://lilian.ai/pricing'),
    src('Clay Sequencer launch', 'https://www.clay.com/blog/sequencer'),
  ];
  const report = assessOutputQuality({
    product: 'Lilian',
    competitor: 'Clay',
    sources,
    answer: 'Compete with Clay on intent workflows for B2B SDR teams.',
    recommendations: [
      {
        title: 'Ship intent workflow MVP',
        rationale: 'Clay is commoditizing enrichment.',
        evidence: ['Clay Sequencer launch'],
        confidence: 'high',
        priority: 'immediate',
      },
    ],
    agentConfidenceAvg: 0.75,
  });
  const guarded = applyOutputQualityGate({
    product: 'Lilian',
    competitor: 'Clay',
    sources,
    answer: 'Compete with Clay on intent workflows for B2B SDR teams.',
    recommendations: [
      {
        title: 'Ship intent workflow MVP',
        rationale: 'Clay is commoditizing enrichment.',
        evidence: ['Clay Sequencer launch'],
        confidence: 'high',
        priority: 'immediate',
      },
    ],
    followUps: ['Which ICP first?'],
    agentConfidenceAvg: 0.75,
  });

  return [
    check(
      'Clear product → do not abstain',
      report.shouldAbstainFromStrongClaims === false,
      `abstain=${report.shouldAbstainFromStrongClaims}; matched=${report.matchedSourceCount}/${report.totalSourceCount}`,
    ),
    check(
      'Clear product → no evidence warning',
      !/Heads up:/i.test(guarded.answer) && !/Evidence quality check/i.test(guarded.answer),
      guarded.answer.slice(0, 80),
    ),
    check(
      'Clear product → keep immediate priority',
      guarded.recommendations[0]?.priority === 'immediate',
      `priority=${guarded.recommendations[0]?.priority}`,
    ),
  ];
}

function scenarioFilterNoise(): Check[] {
  const sources = [
    src('Lilian AI SDR platform overview', 'https://example.com/lilian'),
    src('Show HN: A minimal neumorphic CSS library', 'https://news.ycombinator.com/item?id=1'),
    src('Clay Product Roundup 2026', 'https://www.clay.com/blog/roundup'),
    src('Duolingo micro-wins guide', 'https://example.com/duolingo'),
  ];
  const terms = buildEntityTerms('Lilian', 'Clay');
  const { kept, dropped } = filterSourcesByEntityRelevance(sources, terms);
  const titles = kept.map((s) => s.title);

  return [
    check(
      'Filter drops neumorphic + Duolingo noise',
      dropped === 2 && titles.length === 2,
      `kept=${titles.length}; dropped=${dropped}; titles=${titles.join(' | ')}`,
    ),
    check(
      'Filter keeps Lilian + Clay',
      titles.includes('Lilian AI SDR platform overview') &&
        titles.includes('Clay Product Roundup 2026'),
      titles.join(' | '),
    ),
  ];
}

function scenarioNotionBaseline(): Check[] {
  const sources = [
    src('Notion AI vs Linear for product teams', 'https://www.g2.com/compare/notion-vs-linear'),
    src('Notion pricing 2026', 'https://www.notion.so/pricing'),
    src('Linear roadmap updates', 'https://linear.app/changelog'),
    src('Notion vs Linear positioning', 'https://techcrunch.com/notion-linear'),
  ];
  const report = assessOutputQuality({
    product: 'Notion',
    competitor: 'Linear',
    sources,
    answer: 'Notion should deepen AI workflows for PM teams to compete with Linear speed.',
    recommendations: [
      {
        title: 'Ship AI workflow pack',
        rationale: 'Linear wins on speed; Notion wins on docs.',
        evidence: ['G2 comparison'],
        confidence: 'high',
        priority: 'immediate',
      },
    ],
    agentConfidenceAvg: 0.8,
  });

  return [
    check(
      'Notion vs Linear baseline → no abstain',
      report.shouldAbstainFromStrongClaims === false,
      `matched=${report.matchedSourceCount}; score=${report.evidenceScore.toFixed(2)}`,
    ),
  ];
}

function scenarioNoFakeCompetitorSearch(): Check[] {
  const bundle = planQueries({
    product: 'Anthropic',
    domain: 'competitive',
    query: 'What should Anthropic build next to grow market share?',
  });
  const blob = `${bundle.broad}\n${bundle.targeted}\n${bundle.hypothesis}`;

  return [
    check(
      'No competitor → no "top competitors" string',
      !blob.includes('top competitors'),
      bundle.broad,
    ),
    check(
      'No competitor → no "relevant competitors" string',
      !blob.includes('relevant competitors'),
      bundle.broad,
    ),
    check(
      'No competitor → uses product alternatives framing',
      /competitors alternatives|competitive landscape/i.test(blob),
      bundle.broad,
    ),
  ];
}

function scenarioVagueProduct(): Check[] {
  const report = assessOutputQuality({
    product: 'unknown product',
    sources: [
      src('Random SaaS article', 'https://example.com/saas'),
      src('Another generic post', 'https://example.com/post'),
    ],
    answer: 'Pivot immediately into a new category.',
    recommendations: [industrialRec],
    agentConfidenceAvg: 0.7,
  });

  return [
    check(
      'Vague/unknown product → abstain',
      report.shouldAbstainFromStrongClaims === true,
      `flags=${report.flags.join(',')}`,
    ),
    check(
      'Vague/unknown product → weak_entity_resolution',
      report.flags.includes('weak_entity_resolution'),
      `flags=${report.flags.join(',')}`,
    ),
  ];
}

function scenarioCategoryMismatchLilian(): Check[] {
  const sources = [
    src('Lilian Real Estate Virginia', 'https://lilianrealty.com'),
    src('Lilian property listings', 'https://lilianrealty.com/listings'),
    src('Contact Lilian Realty', 'https://lilianrealty.com/contact'),
    src('Apollo Global Management overview', 'https://www.apollo.com'),
  ];
  const answer =
    "Lilian is not currently competitive in the AI SDR market because there is no evidence it operates in that space. Your digital footprint currently identifies Lilian as a local real estate service, and the data for your competitor, Apollo, refers to a private equity firm.";
  const report = assessOutputQuality({
    product: 'Lilian',
    competitor: 'Apollo',
    sources,
    answer,
    recommendations: [
      {
        title: 'Scrub your legacy digital footprint',
        rationale: 'Real estate presence confuses B2B buyers.',
        evidence: ['realty site'],
        confidence: 'high',
        priority: 'immediate',
      },
    ],
    agentConfidenceAvg: 0.85,
  });
  const guarded = applyOutputQualityGate({
    product: 'Lilian',
    competitor: 'Apollo',
    sources,
    answer,
    recommendations: [
      {
        title: 'Scrub your legacy digital footprint',
        rationale: 'Real estate presence confuses B2B buyers.',
        evidence: ['realty site'],
        confidence: 'high',
        priority: 'immediate',
      },
    ],
    followUps: ['What next?'],
    agentConfidenceAvg: 0.85,
  });

  const competitiveIn = {
    agentId: 'competitive',
    domain: 'competitive' as const,
    confidence: 'high' as const,
    confidenceScore: 0.9,
    facts: ['gap'],
    interpretation: ['Lilian vs Apollo'],
    sources: [],
    generatedAt: new Date().toISOString(),
    artifactType: 'competitive-matrix' as const,
    competitor: 'Apollo',
    matrix: [
      {
        feature: 'AI SDR',
        yourProduct: 'strong' as const,
        competitor: 'medium' as const,
        gapDirection: 'advantage' as const,
      },
    ],
    competitorSummary: 'Apollo PE notes',
    hiringSignals: ['Lilian hiring'],
    recentMoves: ['Apollo invested'],
  } satisfies CompetitiveOutput;

  const mindIn = {
    agentId: 'mind-map-synthesis',
    domain: 'market-trends' as const,
    confidence: 'high' as const,
    confidenceScore: 0.85,
    facts: [],
    interpretation: [],
    sources: [],
    generatedAt: new Date().toISOString(),
    artifactType: 'mind-map' as const,
    centralTopic: 'Specialize ICP',
    summary: 'Pricing next',
    branches: [{ id: 'b1', label: 'Specialize ICP', detail: 'Ship', children: [] }],
  } satisfies MindMapOutput;

  const artifacts = applyAbstainToArtifacts([competitiveIn, mindIn], {
    product: 'Lilian',
    competitor: 'Apollo',
    quality: report,
  });
  const competitive = artifacts[0] as CompetitiveOutput;
  const mind = artifacts[1] as MindMapOutput;

  return [
    check(
      'Category mismatch Lilian → flag + abstain',
      report.flags.includes('entity_category_mismatch') && report.shouldAbstainFromStrongClaims,
      `flags=${report.flags.join(',')}`,
    ),
    check(
      'Category mismatch → caution explains wrong business kind',
      /wrong kind of business/i.test(guarded.answer),
      guarded.answer.slice(0, 160).replace(/\n/g, ' '),
    ),
    check(
      'Category mismatch → replace strategy recs with URL/name',
      /official product URL/i.test(guarded.recommendations[0]?.title ?? '') &&
        !/scrub|footprint|rebrand/i.test(guarded.recommendations.map((r) => r.title).join(' ')),
      guarded.recommendations.map((r) => r.title).join(' | '),
    ),
    check(
      'Category mismatch → hide competitive matrix rows/hiring',
      competitive.matrix.length === 0 &&
        competitive.hiringSignals.length === 0 &&
        competitive.recentMoves.length === 0,
      `matrix=${competitive.matrix.length}; hiring=${competitive.hiringSignals.length}`,
    ),
    check(
      'Category mismatch → identity mind map (not ICP)',
      /identity/i.test(mind.centralTopic) &&
        mind.branches.some((b) => /Confirm official URL/i.test(b.label)) &&
        !mind.branches.some((b) => /Specialize/i.test(b.label)),
      `topic=${mind.centralTopic}; branches=${mind.branches.map((b) => b.label).join(',')}`,
    ),
  ];
}

function scenarioClearNotionStayStrong(): Check[] {
  const sources = Array.from({ length: 8 }, (_, i) =>
    src(`Notion product review ${i}`, `https://www.g2.com/products/notion/reviews?p=${i}`),
  );
  const report = assessOutputQuality({
    product: 'Notion',
    competitor: 'Linear',
    sources,
    answer: 'Notion should deepen AI workflows for PM teams.',
    recommendations: [
      {
        title: 'Ship AI workflow pack',
        rationale: 'Linear wins on speed.',
        evidence: ['G2'],
        confidence: 'high',
        priority: 'immediate',
      },
    ],
    agentConfidenceAvg: 0.8,
  });
  const artifacts = applyAbstainToArtifacts(
    [
      {
        agentId: 'competitive',
        domain: 'competitive',
        confidence: 'high',
        confidenceScore: 0.9,
        facts: ['x'],
        interpretation: ['Notion vs Linear'],
        sources: [],
        generatedAt: new Date().toISOString(),
        artifactType: 'competitive-matrix',
        competitor: 'Linear',
        matrix: [
          {
            feature: 'Docs',
            yourProduct: 'strong',
            competitor: 'medium',
            gapDirection: 'advantage',
          },
        ],
        competitorSummary: 'Notion leads docs',
        hiringSignals: ['Notion hiring'],
        recentMoves: ['Notion AI'],
      } as CompetitiveOutput,
    ],
    { product: 'Notion', competitor: 'Linear', quality: report },
  );

  return [
    check(
      'Clear Notion → no abstain',
      report.shouldAbstainFromStrongClaims === false,
      `flags=${report.flags.join(',') || 'none'}`,
    ),
    check(
      'Clear Notion → artifacts unchanged (no contextOnly)',
      artifacts[0].contextOnly !== true &&
        (artifacts[0] as CompetitiveOutput).matrix.length === 1,
      `contextOnly=${artifacts[0].contextOnly}`,
    ),
  ];
}

function main() {
  const suites: { title: string; checks: Check[] }[] = [
    { title: '1. Ambiguous Lilian (should abstain)', checks: scenarioAmbiguousLilian() },
    { title: '2. Clear Lilian product sources (should stay strong)', checks: scenarioClearProductSources() },
    { title: '3. Source noise filter', checks: scenarioFilterNoise() },
    { title: '4. Notion vs Linear baseline', checks: scenarioNotionBaseline() },
    { title: '5. Missing competitor search hygiene', checks: scenarioNoFakeCompetitorSearch() },
    { title: '6. Vague / unknown product', checks: scenarioVagueProduct() },
    { title: '7. Category mismatch Lilian + Apollo (user-facing noise)', checks: scenarioCategoryMismatchLilian() },
    { title: '8. Clear Notion stays strong (no soft-label)', checks: scenarioClearNotionStayStrong() },
  ];

  let passed = 0;
  let failed = 0;

  console.log('\n=== Veracity output-quality validation ===\n');

  for (const suite of suites) {
    console.log(suite.title);
    for (const c of suite.checks) {
      const mark = c.pass ? 'PASS' : 'FAIL';
      if (c.pass) passed += 1;
      else failed += 1;
      console.log(`  [${mark}] ${c.name}`);
      console.log(`         ${c.detail}`);
    }
    console.log('');
  }

  console.log(`Summary: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
