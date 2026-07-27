const fs = require('fs');
const path = require('path');

const queries = [];
const add = (category, tier, domains, q, meta = {}) => {
  queries.push({
    id: `q${String(queries.length + 1).padStart(3, '0')}`,
    category,
    tier,
    domains,
    query: q,
    ...meta,
  });
};

['hi', 'hello', 'hey', 'help', 'who are you', 'what can you do', 'how do you work', 'what is cac', 'greetings', 'thanks', '???', 'asdfgh'].forEach((q) =>
  add('tier0', 0, [], q),
);

const t12 = [
  [['pricing'], 'What is Notion pricing?'],
  [['pricing'], 'How much does Linear cost?'],
  [['pricing'], 'Figma pricing tiers 2026'],
  [['competitive'], 'Who competes with HubSpot?'],
  [['competitive'], 'Clay vs Apollo feature comparison'],
  [['market-trends'], 'AI SDR market trends'],
  [['market-trends'], 'GTM tooling category outlook'],
  [['positioning', 'competitive'], 'How does Gong position against Chorus?'],
  [['win-loss', 'competitive'], 'Why do buyers switch from Outreach to Salesloft?'],
  [['pricing', 'competitive'], 'Compare Salesforce and HubSpot pricing'],
  [['positioning'], 'What is Vector Agents positioning?'],
  [['adjacent'], 'Adjacent threats to email sequencing tools'],
  [['competitive', 'pricing'], 'Intercom vs Zendesk competitive landscape'],
  [['market-trends', 'pricing'], 'Willingness to pay for AI research tools'],
  [['win-loss'], 'Win/loss drivers for CRM deals'],
  [['pricing'], 'Apollo.io pricing breakdown'],
  [['competitive'], 'Competitor moves by Lavender'],
  [['positioning', 'competitive'], 'Positioning gaps: Notion vs Coda'],
  [['market-trends'], 'Agentic GTM adoption signals'],
  [['pricing', 'positioning'], 'Packaging models for PLG SaaS'],
  [['competitive'], 'Feature matrix: Attio vs Salesforce'],
  [['win-loss', 'competitive'], 'Why teams churn from Pipedrive'],
];
t12.forEach(([domains, q]) => add('tier1_2', domains.length <= 1 ? 1 : 2, domains, q));

const products = [
  'Vector Agents', 'Clay', 'Apollo', 'Gong', 'HubSpot', 'Notion', 'Linear', 'Figma', 'Attio', 'Salesloft',
  'Outreach', 'Lavender', 'Instantly', 'Smartlead', 'Close', 'Pipedrive', 'Affinity', 'Folk', 'Harmonic',
  'PhantomBuster', 'Lemlist', 'Woodpecker', 'Reply.io', 'Mixmax', 'Superhuman', 'Front', 'Missive', 'Drift',
  'Intercom', 'Zendesk', 'Freshworks',
];
products.forEach((p, i) => {
  const rival = products[(i + 3) % products.length];
  add(
    'tier3',
    3,
    ['market-trends', 'competitive', 'win-loss', 'pricing', 'positioning', 'adjacent'],
    `What should ${p} build next to beat ${rival}? Full competitive and GTM analysis.`,
  );
});

[
  'Write a cold email for Vector Agents targeting CTOs',
  'Draft 3 LinkedIn variants for Clay outreach',
  'Generate A/B test angles for Apollo cold email',
  'Create a campaign brief for Gong enterprise launch',
  'Compose landing page pitch for HubSpot competitor displacement',
  'Ship an outreach sequence for Notion AI upsell',
  'Give me 5 message variants for Linear PLG',
  'Build an email campaign for Figma enterprise SDRs',
  'Draft a one-pager for investor outreach about Attio',
  'Launch LinkedIn post variants about Salesloft ROI',
  'Create ad copy for Instantly AI senders',
  'GTM plan and campaign brief for Smartlead',
  'Write falsifiable hypotheses for Close.com A/B tests',
  'Generate outreach sequence for Pipedrive mid-market',
  'Draft cold emails comparing Affinity vs Folk',
  'Produce LinkedIn hooks for Harmonic recruiting GTM',
].forEach((q) => add('execution', 4, ['competitive', 'positioning', 'pricing'], q, { forceExecution: true }));

[
  'Research Lilian pricing strategy',
  'What does Jordan sell and who are competitors?',
  'Analyze Taylor market positioning',
  'Morgan competitive landscape and pricing',
  'Compare Avery vs competitors in SaaS',
  'What should Riley build next?',
  'Cameron win/loss analysis vs rivals',
  'Quinn product positioning and ICP',
  'Harper pricing tiers and packaging',
  'Reese competitive threats and adjacent markets',
  'Alex GTM strategy and messaging gaps',
].forEach((q) => add('homonym', 3, ['competitive', 'positioning', 'pricing'], q, { trap: 'person_name' }));

[
  'Competitive analysis for ZzyzxMetrics AI',
  'Pricing for QuorraFlux GTM',
  'What should NebulaScribe build next?',
  'Win/loss for PixelMarrow analytics',
  'Positioning for OrthoCanvas B2B',
  'Market trends for PlumeLedger',
  'Adjacent threats to CoralVault CRM',
  'Compare FathomlessHQ vs rivals',
  'Packaging for EmberQuill sales AI',
  'Full swarm research on NimbusWicket',
  'GTM strategy for BrambleForge',
].forEach((q) => add('thin_evidence', 3, ['market-trends', 'competitive', 'pricing'], q, { expectThin: true }));

[
  { q: 'Refine the Vector Agents vs Clay analysis with more pricing evidence', injected: 'User rejected "raise prices" recommendation.' },
  { q: 'Follow up: focus only on win/loss for Gong', injected: 'Prior thumbs-down on positioning card.' },
  { q: 'Update HubSpot outreach variants after poor reply rates', injected: 'Campaign reply rate 0.8% — invert messaging.' },
  { q: 'Re-run Notion competitive sweep with stronger sources', injected: 'Quality gate abstained last run.' },
  { q: 'Refine Linear pricing recommendations', injected: 'Accepted "usage-based packaging" hypothesis.' },
  { q: 'Targeted follow-up on Apollo hiring signals only', injected: 'User asked for competitive hiring only.' },
].forEach(({ q, injected }) =>
  add('refine', 2, ['competitive', 'pricing', 'win-loss'], q, { injectedContext: injected }),
);

const out = {
  version: 1,
  generatedAt: new Date().toISOString(),
  count: queries.length,
  queries,
};
const dest = path.join(__dirname, 'queries.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2));
const counts = {};
for (const q of queries) counts[q.category] = (counts[q.category] || 0) + 1;
console.log('wrote', dest, 'count', queries.length, counts);
