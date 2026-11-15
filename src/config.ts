import { parseArgs } from 'node:util';

import { UsageError } from './errors.ts';
import { MS_PER_SECOND } from './units.ts';

export interface Config {
  readonly url: URL;
  readonly count: number;
  readonly idleTimeoutMs: number;
}

export type Command =
  { readonly kind: 'help' } | { readonly kind: 'measure'; readonly config: Config };

const DEFAULT_COUNT = 10;
const DEFAULT_TIMEOUT_SECONDS = 30;
// setTimeout silently fires after 1 ms for longer delays.
const MAX_TIMEOUT_MS = 2 ** 31 - 1;
const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

export const USAGE = `Usage: speedtest <url> [options]

Measures download speed by fetching <url> several times in a row.

Options:
  -n, --count <number>     number of sequential requests (default: ${String(DEFAULT_COUNT)})
  -t, --timeout <seconds>  abort a request after this long without data (default: ${String(DEFAULT_TIMEOUT_SECONDS)})
  -h, --help               show this help`;

export function parseCommand(args: readonly string[]): Command {
  const { values, positionals } = parseRawArgs(args);
  if (values.help) {
    return { kind: 'help' };
  }

  const [url, ...extra] = positionals;
  if (url === undefined) {
    throw new UsageError('Missing <url> argument');
  }
  if (extra.length > 0) {
    throw new UsageError(`Unexpected arguments: ${extra.join(' ')}`);
  }

  return {
    kind: 'measure',
    config: {
      url: parseUrl(url),
      count: values.count === undefined ? DEFAULT_COUNT : parseCount(values.count),
      idleTimeoutMs:
        values.timeout === undefined
          ? DEFAULT_TIMEOUT_SECONDS * MS_PER_SECOND
          : parseTimeoutMs(values.timeout),
    },
  };
}

function parseRawArgs(args: readonly string[]) {
  try {
    return parseArgs({
      args: [...args],
      allowPositionals: true,
      strict: true,
      options: {
        count: { type: 'string', short: 'n' },
        timeout: { type: 'string', short: 't' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (error) {
    // parseArgs signals bad input with ERR_PARSE_ARGS_* codes; anything else is a bug.
    if (
      error instanceof TypeError &&
      'code' in error &&
      String(error.code).startsWith('ERR_PARSE_ARGS')
    ) {
      throw new UsageError(error.message, { cause: error });
    }
    throw error;
  }
}

function parseUrl(value: string): URL {
  const url = URL.parse(value);
  if (url === null) {
    throw new UsageError(`Invalid URL: ${value}`);
  }
  if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
    throw new UsageError(`Unsupported protocol ${url.protocol} — use http or https`);
  }
  return url;
}

function parseCount(value: string): number {
  const count = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new UsageError(`--count must be a positive integer, got "${value}"`);
  }
  return count;
}

function parseTimeoutMs(value: string): number {
  const seconds = value.trim() === '' ? Number.NaN : Number(value);
  const ms = seconds * MS_PER_SECOND;
  if (!Number.isFinite(ms) || ms < 1 || ms > MAX_TIMEOUT_MS) {
    throw new UsageError(
      `--timeout must be a number of seconds between 0.001 and ${String(MAX_TIMEOUT_MS / MS_PER_SECOND)}, got "${value}"`,
    );
  }
  return ms;
}
