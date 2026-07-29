import { query } from '@/lib/db';
import { normalizeEntityKey } from '@/lib/kg/normalize';

import {
  continuousScopeKey,
  normalizeOfficialDomain,
  stableContentHash,
  type CanonicalEntity,
  type CanonicalEntityType,
  type ContinuousScope,
} from '@/lib/continuous-intelligence/entity-utils';

export {
  continuousScopeKey,
  normalizeOfficialDomain,
  stableContentHash,
  type CanonicalEntity,
  type CanonicalEntityType,
  type ContinuousScope,
};


export async function upsertCanonicalEntity(input: ContinuousScope & {
  type: CanonicalEntityType;
  displayName: string;
  aliases?: string[];
  officialDomains?: string[];
  productLines?: string[];
  props?: Record<string, unknown>;
  confidence?: number;
}): Promise<CanonicalEntity> {
  const scopeKey = continuousScopeKey(input);
  const entityKey = normalizeEntityKey(input.displayName);
  const domains = unique(
    (input.officialDomains ?? [])
      .map(normalizeOfficialDomain)
      .filter((value): value is string => Boolean(value)),
  );
  const productLines = unique(input.productLines ?? []);
  const aliases = unique([input.displayName, ...(input.aliases ?? []), ...domains]);

  const { rows } = await query<CanonicalEntity>(
    `INSERT INTO canonical_entities (
       user_id, workspace_id, scope_key, entity_key, entity_type, display_name,
       official_domains, product_lines, props, confidence
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
     ON CONFLICT (scope_key, entity_type, entity_key) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       official_domains = (
         SELECT ARRAY(
           SELECT DISTINCT value
           FROM unnest(canonical_entities.official_domains || EXCLUDED.official_domains) AS value
           ORDER BY value
         )
       ),
       product_lines = (
         SELECT ARRAY(
           SELECT DISTINCT value
           FROM unnest(canonical_entities.product_lines || EXCLUDED.product_lines) AS value
           ORDER BY value
         )
       ),
       props = canonical_entities.props || EXCLUDED.props,
       confidence = GREATEST(canonical_entities.confidence, EXCLUDED.confidence),
       updated_at = now()
     RETURNING *`,
    [
      input.userId,
      input.workspaceId ?? null,
      scopeKey,
      entityKey,
      input.type,
      input.displayName.trim(),
      domains,
      productLines,
      JSON.stringify(input.props ?? {}),
      Math.max(0, Math.min(1, input.confidence ?? 0.7)),
    ],
  );
  const entity = rows[0];
  for (const alias of aliases) {
    const aliasKey = normalizeEntityKey(alias);
    if (!aliasKey) continue;
    await query(
      `INSERT INTO canonical_entity_aliases (
         entity_id, user_id, workspace_id, scope_key, alias_key, alias, source
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (scope_key, alias_key) DO UPDATE SET
         entity_id = CASE
           WHEN canonical_entity_aliases.entity_id = EXCLUDED.entity_id
             THEN EXCLUDED.entity_id
           ELSE canonical_entity_aliases.entity_id
         END`,
      [
        entity.id,
        input.userId,
        input.workspaceId ?? null,
        scopeKey,
        aliasKey,
        alias,
        domains.includes(alias) ? 'official-domain' : 'monitoring',
      ],
    );
  }
  return entity;
}

export async function resolveCanonicalEntity(
  scope: ContinuousScope,
  nameOrAlias: string,
): Promise<CanonicalEntity | null> {
  const scopeKey = continuousScopeKey(scope);
  const aliasKey = normalizeEntityKey(nameOrAlias);
  const { rows } = await query<CanonicalEntity>(
    `SELECT e.*
     FROM canonical_entity_aliases a
     JOIN canonical_entities e ON e.id = a.entity_id
     WHERE a.scope_key = $1 AND a.alias_key = $2
     LIMIT 1`,
    [scopeKey, aliasKey],
  );
  if (rows[0]) return rows[0];
  const direct = await query<CanonicalEntity>(
    `SELECT * FROM canonical_entities
     WHERE scope_key = $1 AND entity_key = $2
     ORDER BY entity_type = 'competitor' DESC
     LIMIT 1`,
    [scopeKey, aliasKey],
  );
  return direct.rows[0] ?? null;
}

export async function listCanonicalEntities(
  scope: ContinuousScope,
  type?: CanonicalEntityType,
): Promise<CanonicalEntity[]> {
  const params: unknown[] = [continuousScopeKey(scope)];
  const typeClause = type ? ' AND entity_type = $2' : '';
  if (type) params.push(type);
  const { rows } = await query<CanonicalEntity>(
    `SELECT * FROM canonical_entities
     WHERE scope_key = $1${typeClause}
     ORDER BY updated_at DESC`,
    params,
  );
  return rows;
}


function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}


