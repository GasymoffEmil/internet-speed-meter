import type { Sample } from './sample.ts';
import { BITS_PER_BYTE, MS_PER_SECOND } from './units.ts';

export interface Summary {
  readonly count: number;
  readonly totalBytes: number;
  readonly totalDurationMs: number;
  readonly averageDurationMs: number;
  readonly minDurationMs: number;
  readonly maxDurationMs: number;
  /** Total bytes over total transfer time, so slow requests weigh in proportionally. */
  readonly bitsPerSecond: number;
}

export function summarize(samples: readonly Sample[]): Summary {
  if (samples.length === 0) {
    throw new RangeError('Cannot summarize an empty list of samples');
  }
  for (const sample of samples) {
    assertValidSample(sample);
  }

  const durations = samples.map((sample) => sample.durationMs);
  const totalBytes = samples.reduce((sum, sample) => sum + sample.bytes, 0);
  const totalDurationMs = durations.reduce((sum, duration) => sum + duration, 0);

  return {
    count: samples.length,
    totalBytes,
    totalDurationMs,
    averageDurationMs: totalDurationMs / samples.length,
    minDurationMs: Math.min(...durations),
    maxDurationMs: Math.max(...durations),
    bitsPerSecond: (totalBytes * BITS_PER_BYTE) / (totalDurationMs / MS_PER_SECOND),
  };
}

function assertValidSample(sample: Sample): void {
  if (!Number.isSafeInteger(sample.bytes) || sample.bytes < 0) {
    throw new RangeError(
      `Sample bytes must be a non-negative integer, got ${String(sample.bytes)}`,
    );
  }
  // A real network round trip always takes measurable time; zero would make the speed undefined.
  if (!Number.isFinite(sample.durationMs) || sample.durationMs <= 0) {
    throw new RangeError(`Sample duration must be positive, got ${String(sample.durationMs)}`);
  }
}
