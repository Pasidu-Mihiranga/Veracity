/**
 * Seed the prototype demo.
 *
 * The prototype rules permit hard-coded source data but require the agent logic
 * to be real and running, not simulated. This script honours both:
 *
 *  - **Canned:** the page text, in `scripts/seeds/prototype-pages.ts`.
 *  - **Real:** everything else. It calls `runCollection` — the production
 *    pipeline — with the production ports from `createProjectPorts`, and swaps
 *    only `fetchPage`. Content hashing, the no-change short circuit, evidence
 *    extraction, metric observations, change detection and materiality scoring
 *    all execute exactly as they do against live pages.
 *
 * It runs the pipeline **twice**, a month apart, because a single run cannot
 * produce a change: change detection needs a previous state to diff against.
 * That second run is the whole demo — it is the thing a chatbot cannot do.
 *
 * Safe to re-run: the project is upserted by name and the pipeline dedupes
 * change events by `dedupe_key`.
 *
 * Usage:
 *   npm run seed:demo
 *
 * Env comes from Node's own `--env-file=.env` (see the npm script). `@next/env`
 * is not used here: its default export is undefined under tsx's CJS transform,
 * and no other `.ts` script in this repo loads env for the same reason.
 */

async function main() {
  // Imported inside main, after loadEnvConfig above: `lib/db` reads config at
  // import time, so a static import would evaluate before .env is loaded and
  // fail with "DATABASE_URL is missing" on a perfectly configured machine.
  const { query } = await import('@/lib/db');
  const { runCollection } = await import('@/lib/intelligence/collection-run');
  const { createProjectPorts } = await import('@/lib/intelligence/project-collection');
  const { CANNED_PAGES, DEMO_PROJECTS, cannedPage } = await import('./seeds/prototype-pages');

  const EMAIL = process.argv[2] ?? process.env.DEV_SEED_EMAIL ?? 'admin@local.com';

  function fail(message: string): never {
    process.stderr.write(`\n  ${message}\n\n`);
    process.exit(1);
  }

  const { rows: users } = await query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [EMAIL.toLowerCase().trim()],
  );
  if (!users[0]) {
    fail(`No user ${EMAIL}. Run "npm run dev:seed" first, or pass an email.`);
  }
  const userId = users[0].id;

  // ── The project ─────────────────────────────────────────────────────────────

  let totalMaterial = 0;

  for (const demo of DEMO_PROJECTS) {
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
      [userId, demo.name, demo.product, demo.productUrl, demo.competitors,
       demo.geography, demo.decisionContext],
    );
    const projectId = projects[0].id;
    process.stdout.write(`\n  ${demo.name}\n`);

    /**
     * Entity ids must be stable across both runs, or the second run has nothing
     * to diff against and every change reads as new. This mirrors production's
     * `resolveEntity` exactly, so the rows are indistinguishable from ones a
     * live collection would have written.
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

    const pages = CANNED_PAGES.filter((page) => demo.urls.includes(page.url));
    const entityIds = new Map<string, string>();
    for (const label of [...new Set(pages.map((p) => p.entityLabel))]) {
      entityIds.set(
        label,
        await entityIdFor(label, label === demo.product ? 'product' : 'competitor'),
      );
    }

    const sources = pages.map((page) => ({
      url: page.url,
      sourceType: /pricing|trade|wholesale|products/.test(page.url) ? 'pricing' : 'changelog',
      entityId: entityIds.get(page.entityLabel)!,
      entityLabel: page.entityLabel,
      isTracked: true,
      sourceTrust: 'official' as const,
    }));

    // Start clean. Re-running otherwise means the "before" pass sees hashes from
    // the previous run, short-circuits, and there is no diff to show.
    await query(`DELETE FROM source_snapshots WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]);
    await query(`DELETE FROM change_events WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]);

    async function collect(phase: 'before' | 'after') {
      const ports = createProjectPorts(userId, projectId);
      const result = await runCollection(
        sources,
        {
          ...ports,
          // The ONLY thing replaced. Everything else is the production path.
          fetchPage: async (url: string) => {
            const content = cannedPage(url, phase);
            return content ? { content, title: url } : null;
          },
        },
        { decisionFocus: demo.decisionContext },
      );
      process.stdout.write(
        `    ${phase.padEnd(6)} → ${result.stats.sourcesChecked} checked · ` +
          `${result.stats.changed} changed · ${result.stats.unchanged} unchanged · ` +
          `${result.materialChanges.length} material\n`,
      );
      return result;
    }

    await collect('before');

    // Backdate the first run so the second reads as "a month later". The digest
    // window and the timeline both key off observed_at.
    await query(
      `UPDATE source_snapshots SET observed_at = now() - interval '31 days'
        WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId],
    );
    await query(
      `UPDATE evidence_spans SET created_at = now() - interval '31 days'
        WHERE snapshot_id IN (SELECT id FROM source_snapshots WHERE project_id = $1)`,
      [projectId],
    );

    const second = await collect('after');
    totalMaterial += second.materialChanges.length;
  }

  // ── What the demo will show ─────────────────────────────────────────────────

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
      '\n  No change events were detected, so the demo has nothing to show.\n' +
        '  The second run found no diff — check that the canned pages differ.\n\n',
    );
    process.exit(1);
  }

  process.stdout.write(
    `\n  Ready. Sign in as ${EMAIL} and open Home.\n` +
      `  ${totalMaterial} change${totalMaterial === 1 ? '' : 's'} ` +
      'cleared the materiality floor.\n\n',
  );
  process.exit(0);

}

main().catch((err) => {
  process.stderr.write(`\n  Seed failed: ${err?.message ?? err}\n\n`);
  process.exit(1);
});
