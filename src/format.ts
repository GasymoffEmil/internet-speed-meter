import type { Sample } from './sample.ts';
import type { Summary } from './stats.ts';
import { BITS_PER_BYTE, BITS_PER_MEGABIT, BYTES_PER_MEGABYTE, SI_STEP } from './units.ts';

const SCALED_BYTE_UNITS = ['kB', 'MB', 'GB', 'TB'] as const;

// Fixed locale keeps the output stable regardless of the machine it runs on.
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const twoDecimals = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatDuration(ms: number): string {
  return `${oneDecimal.format(ms)} ms`;
}

export function formatBytes(bytes: number): string {
  if (bytes < SI_STEP) {
    return `${integer.format(bytes)} B`;
  }
  let value = bytes;
  let unit = 'B';
  for (const nextUnit of SCALED_BYTE_UNITS) {
    if (value < SI_STEP) {
      break;
    }
    value /= SI_STEP;
    unit = nextUnit;
  }
  return `${twoDecimals.format(value)} ${unit}`;
}

export function formatSpeed(bitsPerSecond: number): string {
  const megabits = bitsPerSecond / BITS_PER_MEGABIT;
  const megabytes = bitsPerSecond / BITS_PER_BYTE / BYTES_PER_MEGABYTE;
  return `${twoDecimals.format(megabits)} Mbit/s (${twoDecimals.format(megabytes)} MB/s)`;
}

/** One progress line, e.g. `Request  3/10: 1,234.5 ms, 12.35 MB`. */
export function formatSample(sample: Sample, index: number, total: number): string {
  const width = String(total).length;
  const position = `${String(index).padStart(width)}/${String(total)}`;
  return `Request ${position}: ${formatDuration(sample.durationMs)}, ${formatBytes(sample.bytes)}`;
}

export function formatSummary(summary: Summary): string {
  const rows: readonly (readonly [string, string])[] = [
    ['Requests', String(summary.count)],
    ['Downloaded', formatBytes(summary.totalBytes)],
    [
      'Average time',
      `${formatDuration(summary.averageDurationMs)} ` +
        `(min ${formatDuration(summary.minDurationMs)}, max ${formatDuration(summary.maxDurationMs)})`,
    ],
    ['Download speed', formatSpeed(summary.bitsPerSecond)],
  ];
  const labelWidth = Math.max(...rows.map(([label]) => label.length)) + 1;
  return rows.map(([label, value]) => `${`${label}:`.padEnd(labelWidth)} ${value}`).join('\n');
}
