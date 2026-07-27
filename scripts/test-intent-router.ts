import { resolveAgentSet } from '../lib/agents/adaptive-selection';
import { isUnclearOrGibberishPrompt } from '../lib/agents/orchestrator';

interface TestCase {
  name: string;
  query: string;
  expectedTier: number;
  expectedMinAgents: number;
  classifierDomains: Array<'market-trends' | 'competitive' | 'win-loss' | 'pricing' | 'positioning' | 'adjacent'>;
}

const TEST_CASES: TestCase[] = [
  {
    name: '1. Greeting',
    query: 'hi',
    expectedTier: 0,
    expectedMinAgents: 0,
    classifierDomains: [],
  },
  {
    name: '2. Capability query',
    query: 'what type of thing you can do',
    expectedTier: 0,
    expectedMinAgents: 0,
    classifierDomains: [],
  },
  {
    name: '3. Identity query',
    query: 'who are you and how do you work',
    expectedTier: 0,
    expectedMinAgents: 0,
    classifierDomains: [],
  },
  {
    name: '4. Generic business concept',
    query: 'what is CAC and NRR?',
    expectedTier: 0,
    expectedMinAgents: 0,
    classifierDomains: [],
  },
  {
    name: '5. Typo / Gibberish input',
    query: 'sghhttwet',
    expectedTier: 0,
    expectedMinAgents: 0,
    classifierDomains: [],
  },
  {
    name: '6. Single-company factual lookup',
    query: "What is Clay's current pricing?",
    expectedTier: 1,
    expectedMinAgents: 1,
    classifierDomains: ['pricing'],
  },
  {
    name: '7. Two-company comparison',
    query: 'Compare Notion and Linear positioning.',
    expectedTier: 2,
    expectedMinAgents: 2,
    classifierDomains: ['competitive', 'positioning'],
  },
  {
    name: '8. Deep strategic research',
    query: 'What should Vector Agents build to capture emerging enterprise demand?',
    expectedTier: 3,
    expectedMinAgents: 6,
    classifierDomains: ['market-trends', 'competitive', 'win-loss', 'pricing', 'positioning', 'adjacent'],
  },
  {
    name: '9. Market competitive question',
    query: 'Is Lilian competitive in the AI SDR market right now?',
    expectedTier: 3,
    expectedMinAgents: 3,
    classifierDomains: ['competitive', 'market-trends', 'positioning'],
  },
  {
    name: '10. Platform provider query',
    query: 'can you tell me about your api povider',
    expectedTier: 0,
    expectedMinAgents: 0,
    classifierDomains: [],
  },
];

console.log('=== Veracity Intent Router & Adaptive Selection Test Suite ===\n');

let passed = 0;
let failed = 0;

for (const tc of TEST_CASES) {
  const result = resolveAgentSet({
    uiSelected: ['market-trends', 'competitive', 'win-loss', 'pricing', 'positioning', 'adjacent'],
    classifierDomains: tc.classifierDomains,
    forceFullSweep: false,
    minAgents: tc.expectedMinAgents,
  });

  const agentCountMatch = result.researchIds.length === tc.expectedMinAgents;

  if (agentCountMatch) {
    console.log(`[PASS] ${tc.name}`);
    console.log(`       query: "${tc.query}"`);
    console.log(`       expectedMinAgents: ${tc.expectedMinAgents} | actualAgentCount: ${result.researchIds.length}`);
    console.log(`       researchIds: [${result.researchIds.join(', ')}]\n`);
    passed++;
  } else {
    console.error(`[FAIL] ${tc.name}`);
    console.error(`       query: "${tc.query}"`);
    console.error(`       expectedMinAgents: ${tc.expectedMinAgents} | actualAgentCount: ${result.researchIds.length}`);
    console.error(`       researchIds: [${result.researchIds.join(', ')}]\n`);
    failed++;
  }
}

console.log(`Result: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
