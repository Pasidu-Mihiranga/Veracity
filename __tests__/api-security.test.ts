import { describe, it, expect } from 'vitest';
import { apiSuccess, apiError, parseAndValidateJson } from '../lib/api-response';
import { z } from 'zod';

describe('API Security & Standardization Helpers', () => {
  it('formats standard apiSuccess envelope', async () => {
    const res = apiSuccess({ hello: 'world' });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toEqual({ hello: 'world' });
    expect(data.timestamp).toBeDefined();
  });

  it('formats standard apiError envelope', async () => {
    const res = apiError('Unauthorized access', 401, 'UNAUTHORIZED');
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(data.error.message).toBe('Unauthorized access');
  });

  it('validates request JSON payload with Zod schema', async () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(18),
    });

    const validReq = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', age: 25 }),
    });

    const result = await parseAndValidateJson(validReq, schema);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@example.com');
    }

    const invalidReq = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', age: 10 }),
    });

    const invalidResult = await parseAndValidateJson(invalidReq, schema);
    expect(invalidResult.success).toBe(false);
    if (!invalidResult.success) {
      expect(invalidResult.response.status).toBe(400);
    }
  });
});
