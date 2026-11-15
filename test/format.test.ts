import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatBytes,
  formatDuration,
  formatSample,
  formatSpeed,
  formatSummary,
} from '../src/format.ts';

describe('formatDuration', () => {
  it('prints milliseconds with one decimal and thousands separators', () => {
    assert.equal(formatDuration(0.04), '0.0 ms');
    assert.equal(formatDuration(12.345), '12.3 ms');
    assert.equal(formatDuration(1234.56), '1,234.6 ms');
  });
});

describe('formatBytes', () => {
  it('prints plain bytes below one kilobyte', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(999), '999 B');
  });

  it('scales by decimal SI steps', () => {
    assert.equal(formatBytes(1000), '1.00 kB');
    assert.equal(formatBytes(1_500_000), '1.50 MB');
    assert.equal(formatBytes(2_345_000_000), '2.35 GB');
  });

  it('stops at the largest unit', () => {
    assert.equal(formatBytes(5_000_000_000_000_000), '5,000.00 TB');
  });
});

describe('formatSpeed', () => {
  it('prints megabits and megabytes per second', () => {
    assert.equal(formatSpeed(80_000_000), '80.00 Mbit/s (10.00 MB/s)');
    assert.equal(formatSpeed(0), '0.00 Mbit/s (0.00 MB/s)');
  });
});

describe('formatSample', () => {
  it('right-aligns the request number to the width of the total', () => {
    const sample = { bytes: 12_345_678, durationMs: 1234.5 };

    assert.equal(formatSample(sample, 3, 10), 'Request  3/10: 1,234.5 ms, 12.35 MB');
    assert.equal(formatSample(sample, 10, 10), 'Request 10/10: 1,234.5 ms, 12.35 MB');
  });
});

describe('formatSummary', () => {
  it('prints an aligned report', () => {
    const report = formatSummary({
      count: 10,
      totalBytes: 123_456_789,
      totalDurationMs: 12_345,
      averageDurationMs: 1234.5,
      minDurationMs: 1100.25,
      maxDurationMs: 1500,
      bitsPerSecond: 80_000_000,
    });

    assert.equal(
      report,
      [
        'Requests:       10',
        'Downloaded:     123.46 MB',
        'Average time:   1,234.5 ms (min 1,100.3 ms, max 1,500.0 ms)',
        'Download speed: 80.00 Mbit/s (10.00 MB/s)',
      ].join('\n'),
    );
  });
});
