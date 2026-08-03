/**
 * Seed watchlists from changes the pipeline already detected.
 *
 * The Watchlists tab reads `watchlists`, `watchlist_items` and `alert_events`,
 * so this fills those tables rather than faking the screen — no mock branch in
 * the UI, nothing to strip before shipping.
 *
 * Split out of `seed-demo-full.ts` because it needs no model calls and no page
 * collection: it reads the change events already stored and turns the material
 * ones into alerts. That makes it seconds rather than minutes, and it can be
 * re-run any time the collection has moved on.
 *
 * Alerts are derived from detected changes, never written from the dataset's
 * prose. An alert nothing detected is a claim the product cannot back, and the
 * first person to click through to the evidence would find nothing behind it.
 *
 * Usage:
 *   npm run seed:watchlists            # seeds admin@local.com
 *   npm run seed:watchlists you@x.com
 */

export async function seedWatchlists(exitWhenDone = true) {
  const { query } = await import('@/lib/db');
  const { DOMAINS } = await import('@/lib/market/dataset');

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

  for (const domain of DOMAINS) {
    const name = `${domain.home} vs the market`;
    const competitors = domain.companies
      .filter((company) => company.label !== domain.home)
      .map((company) => company.label);

    // Upsert by name so a re-run updates the list rather than duplicating it.
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
                last_sweep_at = now() - interval '2 days',
                next_sweep_at = now() + interval '5 days',
                last_sweep_summary = $4, updated_at = now()
          WHERE id = $1 AND user_id = $2`,
        [listId, userId, domain.home, JSON.stringify({ market: domain.label })],
      );
    } else {
      const { rows } = await query<{ id: string }>(
        `INSERT INTO watchlists
           (user_id, name, product, enabled, cadence, health_status,
            last_sweep_at, next_sweep_at, last_sweep_summary)
         VALUES ($1, $2, $3, true, 'weekly', 'healthy',
                 now() - interval '2 days', now() + interval '5 days', $4)
         RETURNING id`,
        [userId, name, domain.home, JSON.stringify({ market: domain.label })],
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

    const { rows: changes } = await query<{
      entity_label: string | null; event_type: string;
      before_value: string | null; after_value: string | null;
      observed_at: string; materiality: number; materiality_reason: string;
    }>(
      `SELECT ent.display_name AS entity_label, e.event_type,
              e.before_value, e.after_value, e.observed_at,
              e.materiality::float8 AS materiality, e.materiality_reason
         FROM change_events e
         LEFT JOIN canonical_entities ent ON ent.id = e.entity_id
         JOIN market_projects p ON p.id = e.project_id
        WHERE p.name = $1 AND e.user_id = $2 AND e.materiality >= 0.5
        ORDER BY e.observed_at DESC
        LIMIT 8`,
      [domain.label, userId],
    );

    for (const change of changes) {
      const who = change.entity_label ?? domain.home;
      const moved = change.before_value && change.after_value
        ? `${change.before_value} → ${change.after_value}`
        : change.event_type.replace(/_/g, ' ');
      const title = `${who} — ${moved}`;
      // Keyed on content, not on the change-event id: a re-collection assigns
      // new ids to the same real-world change, and an id-keyed alert would
      // reappear as a duplicate every time the pipeline ran again.
      const dedupeKey = `seed:${domain.id}:${who}:${moved}`.slice(0, 200);

      await query(
        `INSERT INTO alert_events
           (user_id, watchlist_id, product, competitor, title, summary,
            severity, diff, dedupe_key, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
        [
          userId, listId, domain.home, who, title, change.materiality_reason,
          change.materiality >= 0.75 ? 'high' : 'medium',
          JSON.stringify({ before: change.before_value, after: change.after_value }),
          dedupeKey, change.observed_at,
        ],
      );
    }

    process.stdout.write(
      `  ${name.padEnd(34)} ${competitors.length} tracked · ${changes.length} alerts\n`,
    );
  }

  const { rows: counted } = await query<{ lists: string; items: string; alerts: string }>(
    `SELECT
       (SELECT count(*) FROM watchlists WHERE user_id = $1) AS lists,
       (SELECT count(*) FROM watchlist_items i
          JOIN watchlists w ON w.id = i.watchlist_id WHERE w.user_id = $1) AS items,
       (SELECT count(*) FROM alert_events WHERE user_id = $1) AS alerts`,
    [userId],
  );
  const c = counted[0];
  process.stdout.write(
    `\n  ${c.lists} watchlists · ${c.items} tracked competitors · ${c.alerts} alerts\n\n`,
  );
  // Run directly and it should end the process; imported by the full seeder it
  // must not, or the rest of that run never reports.
  if (exitWhenDone) process.exit(0);
}

// Only self-start when this file is what was executed.
if (process.argv[1]?.includes('seed-watchlists')) {
  void seedWatchlists();
}
