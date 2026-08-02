import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiError, apiSuccess, parseAndValidateJson } from '@/lib/api-response';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

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

export async function PATCH(req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');
  const parsed = await parseAndValidateJson(req, projectSchema);
  if (!parsed.success) return parsed.response;
  const { id } = await context.params;
  const input = parsed.data;
  const { rows } = await query(
    `UPDATE market_projects SET
       name = $1, product = $2, product_url = $3, competitors = $4,
       geography = $5, decision_context = $6, approved_sources = $7,
       blocked_sources = $8, updated_at = now()
     WHERE id = $9 AND user_id = $10
     RETURNING id, name, product, product_url, competitors, geography,
       decision_context, approved_sources, blocked_sources, created_at, updated_at`,
    [
      input.name, input.product, input.productUrl || null, input.competitors,
      input.geography || null, input.decisionContext || null,
      input.approvedSources, input.blockedSources, id, user.id,
    ],
  );
  if (!rows[0]) return apiError('Project not found', 404, 'NOT_FOUND');
  return apiSuccess({ project: rows[0] });
}

export async function DELETE(_req: NextRequest, context: Context) {
  const user = await getCurrentUser();
  if (!user) return apiError('Not authenticated', 401, 'UNAUTHORIZED');
  const { id } = await context.params;
  const result = await query(
    `DELETE FROM market_projects WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, user.id],
  );
  if (!result.rows[0]) return apiError('Project not found', 404, 'NOT_FOUND');
  return apiSuccess({ deleted: id });
}
