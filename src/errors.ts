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
    super(`No data received for ${String(idleTimeoutMs)} ms`);
  }
}

export class NetworkError extends DownloadError {
  override name = 'NetworkError';
}
