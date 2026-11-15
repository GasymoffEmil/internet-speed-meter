import { DownloadError, HttpStatusError, NetworkError, RequestTimeoutError } from './errors.ts';
import type { Sample } from './sample.ts';

export interface Downloader {
  /** Downloads the whole resource and measures the transfer. Rejects with a {@link DownloadError}. */
  download(url: URL): Promise<Sample>;
}

export interface FetchDownloaderOptions {
  /**
   * Abort when no data arrives for this long. Unlike a total timeout, it catches hung
   * connections without cutting off a slow but progressing download of a large file.
   */
  readonly idleTimeoutMs: number;
}

const REQUEST_HEADERS = {
  // Count the bytes as transferred, not the size after transparent decompression.
  'accept-encoding': 'identity',
  'cache-control': 'no-cache',
};

export function createFetchDownloader(options: FetchDownloaderOptions): Downloader {
  return {
    async download(url) {
      const controller = new AbortController();
      const idleTimer = setTimeout(() => {
        controller.abort(new RequestTimeoutError(options.idleTimeoutMs));
      }, options.idleTimeoutMs);
      const startedAt = performance.now();

      try {
        const response = await fetch(url, { headers: REQUEST_HEADERS, signal: controller.signal });
        idleTimer.refresh();

        if (!response.ok) {
          await response.body?.cancel();
          throw new HttpStatusError(response.status, response.statusText);
        }

        let bytes = 0;
        if (response.body) {
          for await (const chunk of response.body) {
            bytes += chunk.byteLength;
            idleTimer.refresh();
          }
        }
        return { bytes, durationMs: performance.now() - startedAt };
      } catch (error) {
        // An aborted fetch rejects with the abort reason, so timeouts arrive here already typed.
        if (error instanceof DownloadError) {
          throw error;
        }
        throw new NetworkError(describeNetworkFailure(error), { cause: error });
      } finally {
        clearTimeout(idleTimer);
      }
    },
  };
}

/** fetch reports every network failure as `TypeError: fetch failed`; the useful detail is in `cause`. */
function describeNetworkFailure(error: unknown): string {
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  if (!(cause instanceof Error)) {
    return `Network error: ${String(cause)}`;
  }
  const code = 'code' in cause && typeof cause.code === 'string' ? cause.code : '';
  // Node often repeats the code inside the message ("getaddrinfo ENOTFOUND host").
  const details =
    code === '' || cause.message.includes(code)
      ? cause.message
      : [code, cause.message].filter(Boolean).join(': ');
  return `Network error: ${details || cause.name}`;
}
