import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { summarize } from '../src/stats.ts';

describe('summarize', () => {
  it('aggregates bytes and durations across samples', () => {
    const summary = summarize([
      { bytes: 1_000_000, durationMs: 100 },
      { bytes: 2_000_000, durationMs: 300 },
      { bytes: 3_000_000, durationMs: 200 },
    ]);

    assert.deepEqual(summary, {
      count: 3,
      totalBytes: 6_000_000,
      totalDurationMs: 600,
      averageDurationMs: 200,
      minDurationMs: 100,
      maxDurationMs: 300,
      // 48,000,000 bits over 0.6 s
      bitsPerSecond: 80_000_000,
    });
  });

  it('computes speed from totals rather than averaging per-request speeds', () => {
    // Per-request speeds are 80 and 8 Mbit/s; their mean (44) would overstate the slow request.
    const summary = summarize([
      { bytes: 1_000_000, durationMs: 100 },
      { bytes: 1_000_000, durationMs: 1000 },
    ]);

    assert.equal(summary.bitsPerSecond, 16_000_000 / 1.1);
  });

  it('handles a single sample', () => {
    const summary = summarize([{ bytes: 500, durationMs: 50 }]);

    assert.equal(summary.averageDurationMs, 50);
    assert.equal(summary.minDurationMs, 50);
    assert.equal(summary.maxDurationMs, 50);
    assert.equal(summary.bitsPerSecond, 80_000);
  });

  it('handles a very large number of samples', () => {
    const samples = Array.from({ length: 500_000 }, (_, i) => ({ bytes: 1, durationMs: i + 1 }));

    const summary = summarize(samples);

    assert.equal(summary.minDurationMs, 1);
    assert.equal(summary.maxDurationMs, 500_000);
  });

  it('reports zero speed for empty responses', () => {
    const summary = summarize([{ bytes: 0, durationMs: 10 }]);

    assert.equal(summary.totalBytes, 0);
    assert.equal(summary.bitsPerSecond, 0);
  });

  it('rejects an empty list', () => {
    assert.throws(() => summarize([]), RangeError);
  });

  it('rejects invalid samples', () => {
    const invalid = [
      { bytes: -1, durationMs: 10 },
      { bytes: 1.5, durationMs: 10 },
      { bytes: 10, durationMs: 0 },
      { bytes: 10, durationMs: -5 },
      { bytes: 10, durationMs: Number.NaN },
      { bytes: 10, durationMs: Number.POSITIVE_INFINITY },
    ];
    for (const sample of invalid) {
      assert.throws(() => summarize([sample]), RangeError, JSON.stringify(sample));
    }
  });
});
