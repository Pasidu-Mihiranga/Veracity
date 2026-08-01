import { describe, expect, it } from 'vitest';
import { buildMarketProjectContext, type MarketProject } from '@/lib/projects';

const project: MarketProject = {
  id: 'project-1',
  name: 'Acme market watch',
  product: 'Acme Analytics',
  product_url: 'https://acme.example',
  competitors: ['Rival One', 'Rival Two'],
  geography: 'Sri Lanka',
  decision_context: 'Choose the next segment to enter',
  approved_sources: ['acme.example', 'regulator.example'],
  blocked_sources: ['spam.example'],
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-01T00:00:00.000Z',
};

describe('market project context', () => {
  it('carries reusable product, competitor, geography, and decision context', () => {
    const context = buildMarketProjectContext(project);
    expect(context).toContain('Product: Acme Analytics');
    expect(context).toContain('Tracked competitors: Rival One, Rival Two');
    expect(context).toContain('Geography: Sri Lanka');
    expect(context).toContain('Decision context: Choose the next segment to enter');
  });

  it('preserves source preferences for research turns', () => {
    const context = buildMarketProjectContext(project);
    expect(context).toContain('Preferred source domains: acme.example, regulator.example');
    expect(context).toContain('Avoid these source domains when alternatives exist: spam.example');
  });
});
