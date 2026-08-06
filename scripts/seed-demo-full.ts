/**
 * Seed the full demo: four markets, eight months of history each.
 *
 * The prototype rules allow hard-coded source data but require the agent logic
 * to be real. This honours both, the same way `seed-prototype-demo.ts` does —
 * it swaps `fetchPage` for a lookup into `lib/market` and changes nothing else.
 * Hashing, the no-change short circuit, evidence extraction, metric
 * observations, change detection and materiality scoring all run the production
 * path. Every change event this produces was computed, not written.
 *
 * The difference from the earlier seeder is depth. Two snapshots give one diff,
 * which is enough to prove the mechanism and not enough to draw a trend. This
 * runs the pipeline once per month across eight months, backdating each pass,
 * so the dashboard opens on a curve rather than a single bar.
 *
 * Safe to re-run: projects upsert by name, and each domain's snapshots and
 * change events are cleared before its first pass so the "before" state is not
 * the previous run's "after".
 *
 * Usage:
 *   npm run seed:full            # seeds admin@local.com
 *   npm run seed:full you@x.com
 */

async function seedFullDemo() {
  // Imported inside main: `lib/db` reads config at import time, so a static
  // import evaluates before --env-file has been applied.
  const { query } = await import('@/lib/db');
  const { runCollection } = await import('@/lib/intelligence/collection-run');
  const { createProjectPorts } = await import('@/lib/intelligence/project-collection');
  const { DOMAINS, MONTHS, domainPages } = await import('@/lib/market/dataset');

  const EMAIL = process.argv[2] ?? process.env.DEV_SEED_EMAIL ?? 'admin@local.com';

  const { rows: users } = await query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [EMAIL.toLowerCase().trim()],
  );
  if (!users[0]) {
    process.stderr.write(`\n  No user ${EMAIL}. Run "npm run dev:seed" first.\n\n`);
    process.exit(1);
  }
  const userId = users[0].id;

  let totalMaterial = 0;

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
    process.stdout.write(`\n  ${domain.label}\n`);

    /**
     * Entity ids must be stable across all eight passes, or each month reads as
     * a brand-new company and nothing ever diffs. Mirrors production's
     * `resolveEntity` so the rows are indistinguishable from live ones.
     */
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

    // Start clean, or the first pass diffs against the previous seed run.
    await query(`DELETE FROM source_snapshots WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]);
    await query(`DELETE FROM change_events WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]);

    for (const [monthIndex, month] of MONTHS.entries()) {
      const runStart = new Date();
      const ports = createProjectPorts(userId, projectId);
      const result = await runCollection(
        sources,
        {
          ...ports,
          // The ONLY substitution. Everything downstream is the production path.
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

      /**
       * Backdate this pass to the middle of its month.
       *
       * Everything time-based downstream — the digest window, the activity
       * chart, the timeline — keys off `observed_at`. Without this, eight passes
       * that ran in nine seconds would all land on today and the history would
       * be a single column.
       */
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
      await query(
        `UPDATE evidence_spans SET created_at = $2
          WHERE created_at >= $3
            AND snapshot_id IN (SELECT id FROM source_snapshots WHERE project_id = $1)`,
        [projectId, stamp, runStart.toISOString()],
      );

      totalMaterial += result.materialChanges.length;
      process.stdout.write(
        `    ${month}  ${String(result.stats.sourcesChecked).padStart(2)} checked · ` +
          `${String(result.stats.changed).padStart(2)} changed · ` +
          `${String(result.stats.unchanged).padStart(2)} unchanged · ` +
          `${result.materialChanges.length} material\n`,
      );
    }
  }

  // Watchlists are seeded from the changes just detected. Kept in its own
  // script so it can be re-run on its own — it needs no model calls.
  const { seedWatchlists } = await import('./seed-watchlists');
  await seedWatchlists(false);

  const { rows: counts } = await query<{
    snapshots: string; spans: string; observations: string; changes: string;
  }>(
    `SELECT
       (SELECT count(*) FROM source_snapshots WHERE user_id = $1) AS snapshots,
       (SELECT count(*) FROM evidence_spans s
          JOIN source_snapshots snap ON snap.id = s.snapshot_id
         WHERE snap.user_id = $1) AS spans,
       (SELECT count(*) FROM metric_observations o
          JOIN evidence_spans s ON s.id = o.evidence_span_id
          JOIN source_snapshots snap ON snap.id = s.snapshot_id
         WHERE snap.user_id = $1) AS observations,
       (SELECT count(*) FROM change_events WHERE user_id = $1) AS changes`,
    [userId],
  );

  const c = counts[0];
  process.stdout.write(
    `\n  Stored: ${c.snapshots} snapshots · ${c.spans} evidence spans · ` +
      `${c.observations} metric observations · ${c.changes} change events\n`,
  );

  if (Number(c.changes) === 0) {
    process.stderr.write(
      '\n  No change events were detected, so there is nothing to show.\n' +
        '  Check that consecutive monthly page bodies actually differ.\n\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    `\n  Ready. Sign in as ${EMAIL} and open Home.\n` +
      `  ${totalMaterial} change${totalMaterial === 1 ? '' : 's'} cleared the materiality floor.\n\n`,
  );
  process.exit(0);
}

void seedFullDemo();
