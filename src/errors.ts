import { MS_PER_SECOND } from './units.ts';

/** Invalid command-line input; reported together with the usage text. */
export class UsageError extends Error {
  override name = 'UsageError';
}

/** Expected failure of a single download; reported to the user as a message, without a stack trace. */
export class DownloadError extends Error {
  override name = 'DownloadError';
}

export class HttpStatusError extends DownloadError {
  override name = 'HttpStatusError';
  readonly status: number;

  constructor(status: number, statusText: string) {
    super(`Server responded with HTTP ${[String(status), statusText].join(' ').trim()}`);
    this.status = status;
  }
}

export class RequestTimeoutError extends DownloadError {
  override name = 'RequestTimeoutError';

  constructor(idleTimeoutMs: number) {
    super(
      `No data received for ${String(idleTimeoutMs / MS_PER_SECOND)} s — ` +
        'the connection may have been lost or the server is not responding',
    );
  }
}

export class NetworkError extends DownloadError {
  override name = 'NetworkError';
}
