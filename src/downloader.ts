import { Agent, errors, fetch } from 'undici';

import { DownloadError, HttpStatusError, NetworkError, RequestTimeoutError } from './errors.ts';
import { describeNetworkFailure } from './network-failure.ts';
import type { Sample } from './sample.ts';

export interface Downloader {
  /** Downloads the whole resource and measures the transfer. Rejects with a {@link DownloadError}. */
  download(url: URL): Promise<Sample>;
}

/** Owns pooled keep-alive connections, so it has to be disposed when measuring is done. */
export type FetchDownloader = Downloader & AsyncDisposable;

export interface FetchDownloaderOptions {
  /**
   * Abort when no data arrives for this long, including while connecting. Unlike a total timeout,
   * it catches hung connections without cutting off a slow but progressing download of a large file.
   */
  readonly idleTimeoutMs: number;
}

const REQUEST_HEADERS = {
  // Count the bytes as transferred, not the size after transparent decompression.
  'accept-encoding': 'identity',
  'cache-control': 'no-cache',
};

export function createFetchDownloader(options: FetchDownloaderOptions): FetchDownloader {
  const agent = new Agent({
    // A single HTTP/2 stream is capped by its flow-control window (window / RTT) and would
    // report that cap instead of the link speed; HTTP/1.1 measures plain TCP throughput.
    allowH2: false,
    // Connecting is subject to the same timeout; otherwise undici's own 10 s default applies.
    connect: { timeout: options.idleTimeoutMs },
  });

  return {
    async download(url) {
      const controller = new AbortController();
      const idleTimer = setTimeout(() => {
        controller.abort(new RequestTimeoutError(options.idleTimeoutMs));
      }, options.idleTimeoutMs);
      const startedAt = performance.now();

      try {
        const response = await fetch(url, {
          headers: REQUEST_HEADERS,
          signal: controller.signal,
          dispatcher: agent,
        });
        idleTimer.refresh();

        if (!response.ok) {
          await response.body?.cancel();
          throw new HttpStatusError(response.status, response.statusText);
        }

        let bytes = 0;
        if (response.body) {
          for await (const chunk of response.body) {
            // undici types body chunks as `any`; the Fetch spec guarantees Uint8Array.
            if (!(chunk instanceof Uint8Array)) {
              throw new TypeError(`Unexpected response body chunk: ${typeof chunk}`);
            }
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
        // Both timers share the same duration; whichever fires first, it is the same timeout.
        if (error instanceof Error && error.cause instanceof errors.ConnectTimeoutError) {
          throw new RequestTimeoutError(options.idleTimeoutMs, { cause: error });
        }
        throw new NetworkError(describeNetworkFailure(error), { cause: error });
      } finally {
        clearTimeout(idleTimer);
      }
    },

    async [Symbol.asyncDispose]() {
      await agent.close();
    },
  };
}
