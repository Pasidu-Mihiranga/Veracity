import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiError, apiSuccess, parseAndValidateJson } from '@/lib/api-response';

export const runtime = 'nodejs';

const projectSchema = z.object({
  name: z.string().trim().min(1).max(100),
  product: z.string().trim().min(1).max(160),
  productUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
  competitors: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  geography: z.string().trim().max(160).optional().default(''),
  decisionContext: z.string().trim().max(1000).optional().default(''),
  approvedSources: z.array(z.string().trim().min(1).max(255)).max(50).default([]),
  blockedSources: z.array(z.string().trim().min(1).max(255)).max(50).default([]),
});

const selectedColumns = `id, name, product, product_url, competitors, geography,
  decision_context, approved_sources, blocked_sources, created_at, updated_at`;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');
  const { rows } = await query(
    `SELECT ${selectedColumns} FROM market_projects WHERE user_id = $1 ORDER BY updated_at DESC`,
    [user.id],
  );
  return apiSuccess({ projects: rows });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');
  const parsed = await parseAndValidateJson(req, projectSchema);
  if (!parsed.success) return parsed.response;
  const input = parsed.data;

  const { rows } = await query(
    `INSERT INTO market_projects
      (user_id, name, product, product_url, competitors, geography, decision_context, approved_sources, blocked_sources)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, name) DO UPDATE SET
       product = EXCLUDED.product,
       product_url = EXCLUDED.product_url,
       competitors = EXCLUDED.competitors,
       geography = EXCLUDED.geography,
       decision_context = EXCLUDED.decision_context,
       approved_sources = EXCLUDED.approved_sources,
       blocked_sources = EXCLUDED.blocked_sources,
       updated_at = now()
     RETURNING ${selectedColumns}`,
    [
      user.id,
      input.name,
      input.product,
      input.productUrl || null,
      input.competitors,
      input.geography || null,
      input.decisionContext || null,
      input.approvedSources,
      input.blockedSources,
    ],
  );
  return apiSuccess({ project: rows[0] }, 201);
}
