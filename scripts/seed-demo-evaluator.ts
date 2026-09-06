/**
 * Dedicated Evaluator & Demo Seed Script for demo@veracity.ai
 *
 * Populates all modules with realistic Sri Lankan enterprise market intelligence:
 * 1. User demo@veracity.ai (Password: DemoVeracity2026!)
 * 2. Market Projects: Telecom, Mobility, Retail Banking, Ceylon Tea, Technical Apparel
 * 3. Historical changes & metric trends across 8 months
 * 4. Active Watchlists & formatted Alert Events (with clear titles and summaries)
 *
 * Usage:
 *   npm run seed:evaluator
 */

import bcrypt from 'bcryptjs';

async function seedEvaluatorDemo() {
  const { query } = await import('@/lib/db');
  const { DOMAINS, MONTHS, domainPages } = await import('@/lib/market/dataset');
  const { runCollection } = await import('@/lib/intelligence/collection-run');
  const { createProjectPorts } = await import('@/lib/intelligence/project-collection');

  const DEMO_EMAIL = 'demo@veracity.ai';
  const DEMO_PASSWORD = 'DemoVeracity2026!';
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  console.log(`\n🚀 [DEMO SEED] Provisioning Evaluator User: ${DEMO_EMAIL}...`);

  const { rows: userRows } = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [DEMO_EMAIL, passwordHash],
  );

  const userId = userRows[0].id;
  console.log(`✅ Demo user ID: ${userId}`);

  console.log(`\n📊 [DEMO SEED] Seeding Market Projects across 5 enterprise sectors...`);

  for (const domain of DOMAINS) {
    const competitors = domain.companies
      .filter((company) => company.label !== domain.home)
      .map((company) => company.label);

    const { rows: projects } = await query<{ id: string }>(
      `INSERT INTO market_projects
         (user_id, name, product, product_url, competitors, geography, decision_context,
          approved_sources, blocked_sources)
       VALUES ($1, $2, $3, $4, $5, $6, $7, '{}', '{}')
       ON CONFLICT (user_id, name) DO UPDATE SET
         product = EXCLUDED.product,
         product_url = EXCLUDED.product_url,
         competitors = EXCLUDED.competitors,
         geography = EXCLUDED.geography,
         decision_context = EXCLUDED.decision_context,
         updated_at = now()
       RETURNING id`,
      [
        userId,
        domain.label,
        domain.home,
        domain.companies.find((c) => c.label === domain.home)?.homeUrl ?? '',
        competitors,
        domain.geography,
        domain.decisionContext,
      ],
    );
    const projectId = projects[0].id;
    console.log(`  ✓ Project: ${domain.label} (ID: ${projectId})`);

    async function entityIdFor(label: string, role: 'product' | 'competitor') {
      const entityKey = label.trim().toLowerCase().replace(/\s+/g, '-');
      const scopeKey = `project:${projectId}`;
      const existing = await query<{ id: string }>(
        `SELECT id FROM canonical_entities
          WHERE user_id = $1 AND scope_key = $2 AND entity_key = $3 AND entity_type = $4`,
        [userId, scopeKey, entityKey, role],
      );
      if (existing.rows[0]) return existing.rows[0].id;
      const created = await query<{ id: string }>(
        `INSERT INTO canonical_entities (user_id, scope_key, entity_key, entity_type, display_name)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [userId, scopeKey, entityKey, role, label.trim()],
      );
      return created.rows[0].id;
    }

    const pages = domainPages(domain);
    const entityIds = new Map<string, string>();
    for (const label of [...new Set(pages.map((p) => p.entityLabel))]) {
      entityIds.set(
        label,
        await entityIdFor(label, label === domain.home ? 'product' : 'competitor'),
      );
    }

    const sources = pages.map(({ page, entityLabel }) => ({
      url: page.url,
      sourceType: page.kind,
      entityId: entityIds.get(entityLabel)!,
      entityLabel,
      isTracked: true,
      sourceTrust: 'official' as const,
    }));

    await query(`DELETE FROM source_snapshots WHERE project_id = $1 AND user_id = $2`, [projectId, userId]);
    await query(`DELETE FROM change_events WHERE project_id = $1 AND user_id = $2`, [projectId, userId]);

    for (const [monthIndex, month] of MONTHS.entries()) {
      const runStart = new Date();
      const ports = createProjectPorts(userId, projectId);
      const result = await runCollection(
        sources,
        {
          ...ports,
          fetchPage: async (url: string) => {
            for (const { page } of pages) {
              if (page.url === url) {
                return { content: page.monthly[monthIndex], title: url };
              }
            }
            return null;
          },
        },
        { decisionFocus: domain.decisionContext },
      );

      const stamp = `${month}-15T09:00:00Z`;
      await query(
        `UPDATE source_snapshots SET observed_at = $3
          WHERE project_id = $1 AND user_id = $2 AND observed_at >= $4`,
        [projectId, userId, stamp, runStart.toISOString()],
      );
      await query(
        `UPDATE change_events SET observed_at = $3
          WHERE project_id = $1 AND user_id = $2 AND observed_at >= $4`,
        [projectId, userId, stamp, runStart.toISOString()],
      );
    }
  }

  console.log(`\n🔔 [DEMO SEED] Populating Watchlists & Alert Events...`);

  for (const domain of DOMAINS) {
    const name = `${domain.home} vs the market`;
    const competitors = domain.companies
      .filter((company) => company.label !== domain.home)
      .map((company) => company.label);

    const { rows: existing } = await query<{ id: string }>(
      `SELECT id FROM watchlists WHERE user_id = $1 AND name = $2 LIMIT 1`,
      [userId, name],
    );

    let listId: string;
    if (existing[0]) {
      listId = existing[0].id;
      await query(
        `UPDATE watchlists
            SET product = $3, enabled = true, cadence = 'weekly',
                health_status = 'healthy',
                last_sweep_at = now() - interval '2 hours',
                next_sweep_at = now() + interval '5 days',
                last_sweep_summary = $4, updated_at = now()
          WHERE id = $1 AND user_id = $2`,
        [listId, userId, domain.home, JSON.stringify({ market: domain.label, totalAlerts: 4 })],
      );
    } else {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO watchlists
           (user_id, name, product, enabled, cadence, health_status,
            last_sweep_at, next_sweep_at, last_sweep_summary)
         VALUES ($1, $2, $3, true, 'weekly', 'healthy',
                 now() - interval '2 hours', now() + interval '5 days', $4)
         RETURNING id`,
        [userId, name, domain.home, JSON.stringify({ market: domain.label, totalAlerts: 4 })],
      );
      listId = rows[0].id;
    }

    for (const competitor of competitors) {
      const url = domain.companies.find((c) => c.label === competitor)?.homeUrl ?? null;
      await query(
        `INSERT INTO watchlist_items (watchlist_id, competitor, competitor_url)
         SELECT $1, $2, $3
          WHERE NOT EXISTS (
            SELECT 1 FROM watchlist_items WHERE watchlist_id = $1 AND competitor = $2
          )`,
        [listId, competitor, url],
      );
    }

    const alertTemplates = [
      {
        competitor: competitors[0] || 'Competitor',
        severity: 'high',
        title: `${competitors[0] || 'Competitor'} adjusted enterprise pricing tier by 15%`,
        summary: `Observed competitive tariff and pricing structure updates across core subscription packages.`,
        dedupeKey: `demo-pricing-${listId}-${competitors[0] || 'comp'}`,
      },
      {
        competitor: competitors[0] || 'Competitor',
        severity: 'medium',
        title: `${competitors[0] || 'Competitor'} launched new digital service feature`,
        summary: `Updated product changelog and customer documentation highlighting new automation workflows.`,
        dedupeKey: `demo-feature-${listId}-${competitors[0] || 'comp'}`,
      },
      {
        competitor: competitors[1] || competitors[0] || 'Competitor',
        severity: 'medium',
        title: `${competitors[1] || 'Competitor'} updated homepage value proposition`,
        summary: `Hero messaging pivoted to emphasize sustainability credentials and regional service speed.`,
        dedupeKey: `demo-positioning-${listId}-${competitors[1] || 'comp'}`,
      },
      {
        competitor: domain.home,
        severity: 'low',
        title: `Market quarterly growth index updated for ${domain.label}`,
        summary: `Verified quarterly industry volume trends showing category acceleration.`,
        dedupeKey: `demo-market-${listId}-${domain.home}`,
      },
    ];

    for (const t of alertTemplates) {
      await query(
        `INSERT INTO alert_events
           (user_id, watchlist_id, product, competitor, title, summary, severity, diff, dedupe_key, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '{}', $8, now() - interval '2 hours')
         ON CONFLICT (user_id, dedupe_key) DO UPDATE SET
           title = EXCLUDED.title,
           summary = EXCLUDED.summary,
           severity = EXCLUDED.severity,
           product = EXCLUDED.product,
           competitor = EXCLUDED.competitor`,
        [userId, listId, domain.home, t.competitor, t.title, t.summary, t.severity, t.dedupeKey],
      );
    }
  }

  console.log(`\n🎉 [DEMO SEED COMPLETE] Successfully seeded enterprise demo data for ${DEMO_EMAIL}!`);
}

seedEvaluatorDemo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed demo error:', err);
    process.exit(1);
  });
