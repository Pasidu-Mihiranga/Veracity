import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  getCorrelationId,
  logger,
  withCorrelation,
  withToolLatency,
} from '@/lib/logger';
import {
  estimateGeminiCostUsd,
  parseGeminiUsage,
  recordGeminiUsage,
  resetGeminiUsageTotals,
  getGeminiUsageTotals,
} from '@/lib/gemini-usage';

describe('logger correlation', () => {
  it('exposes correlation id inside withCorrelation', () => {
    withCorrelation({ correlationId: 'corr-test-1', userId: 'u1' }, () => {
      expect(getCorrelationId()).toBe('corr-test-1');
    });
  });

  it('writes JSON log lines', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    withCorrelation({ correlationId: 'corr-log' }, () => {
      logger.info('hello', { a: 1 });
    });
    expect(spy).toHaveBeenCalled();
    const line = String(spy.mock.calls[0][0]);
    const parsed = JSON.parse(line);
    expect(parsed.msg).toBe('hello');
    expect(parsed.correlationId).toBe('corr-log');
    expect(parsed.a).toBe(1);
    spy.mockRestore();
  });
});

describe('withToolLatency', () => {
  it('logs latency on success', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const value = await withToolLatency('demo', async () => 42);
    expect(value).toBe(42);
    const line = String(spy.mock.calls.at(-1)?.[0] ?? '');
    expect(JSON.parse(line).msg).toBe('tool.ok');
    spy.mockRestore();
  });
});

describe('gemini usage', () => {
  beforeEach(() => resetGeminiUsageTotals());
  afterEach(() => resetGeminiUsageTotals());

  it('parses usageMetadata', () => {
    const usage = parseGeminiUsage({
      usageMetadata: {
        promptTokenCount: 100,
        candidatesTokenCount: 50,
        totalTokenCount: 150,
        thoughtsTokenCount: 10,
      },
    });
    expect(usage).toEqual({
      promptTokenCount: 100,
      candidatesTokenCount: 50,
      totalTokenCount: 150,
      thoughtsTokenCount: 10,
    });
  });

  it('estimates cost and accumulates totals', () => {
    recordGeminiUsage({
      usageMetadata: { promptTokenCount: 1_000_000, candidatesTokenCount: 1_000_000, totalTokenCount: 2_000_000 },
    });
    // $0.10 input + $0.40 output per 1M
    expect(estimateGeminiCostUsd({
      promptTokenCount: 1_000_000,
      candidatesTokenCount: 1_000_000,
      totalTokenCount: 2_000_000,
    })).toBeCloseTo(0.5, 5);

    const totals = getGeminiUsageTotals();
    expect(totals.calls).toBe(1);
    expect(totals.promptTokens).toBe(1_000_000);
    expect(totals.estimatedCostUsd).toBeCloseTo(0.5, 5);
  });
});
