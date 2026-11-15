import assert from 'node:assert/strict';
import type { IncomingHttpHeaders } from 'node:http';
import { Readable } from 'node:stream';
import { after, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { createFetchDownloader } from '../src/downloader.ts';
import { HttpStatusError, NetworkError, RequestTimeoutError } from '../src/errors.ts';
import { startServer } from './support/server.ts';

const CHUNK = Buffer.alloc(64 * 1024, 1);

describe('createFetchDownloader', () => {
  const downloader = createFetchDownloader({ idleTimeoutMs: 1000 });
  after(() => downloader[Symbol.asyncDispose]());

  it('counts every byte of a streamed body', async () => {
    await using server = await startServer((_request, response) => {
      // No Content-Length: chunked transfer, so the size can only come from reading the body.
      for (let i = 0; i < 4; i += 1) response.write(CHUNK);
      response.end();
    });

    const sample = await downloader.download(server.url);

    assert.equal(sample.bytes, 4 * CHUNK.length);
    assert.ok(sample.durationMs > 0);
  });

  it('handles an empty body', async () => {
    await using server = await startServer((_request, response) => {
      response.statusCode = 204;
      response.end();
    });

    const sample = await downloader.download(server.url);

    assert.equal(sample.bytes, 0);
  });

  it('asks for an uncompressed, non-cached response', async () => {
    let headers: IncomingHttpHeaders = {};
    await using server = await startServer((request, response) => {
      headers = request.headers;
      response.end();
    });

    await downloader.download(server.url);

    assert.equal(headers['accept-encoding'], 'identity');
    assert.equal(headers['cache-control'], 'no-cache');
  });

  it('rejects non-2xx responses with the status code', async () => {
    await using server = await startServer((_request, response) => {
      response.statusCode = 404;
      response.end('not found');
    });

    await assert.rejects(downloader.download(server.url), (error: unknown) => {
      assert.ok(error instanceof HttpStatusError);
      assert.equal(error.status, 404);
      assert.equal(error.message, 'Server responded with HTTP 404 Not Found');
      return true;
    });
  });

  describe('idle timeout', () => {
    const impatient = createFetchDownloader({ idleTimeoutMs: 100 });
    after(() => impatient[Symbol.asyncDispose]());

    it('fires when the server never responds', async () => {
      await using server = await startServer(() => {
        // Never respond.
      });

      await assert.rejects(impatient.download(server.url), RequestTimeoutError);
    });

    it('fires when the body stalls midway, as when the network silently disappears', async () => {
      await using server = await startServer((_request, response) => {
        response.write(CHUNK);
        // Never end.
      });

      await assert.rejects(impatient.download(server.url), {
        name: 'RequestTimeoutError',
        message:
          'No data received for 0.1 s — the connection may have been lost or the server is not responding',
      });
    });

    it('does not cut off a slow download that keeps making progress', async () => {
      // Total time well above the idle timeout, but no single gap reaches it.
      async function* slowChunks(): AsyncGenerator<Buffer> {
        for (let i = 0; i < 5; i += 1) {
          yield CHUNK;
          await delay(50);
        }
      }
      await using server = await startServer((_request, response) => {
        Readable.from(slowChunks()).pipe(response);
      });

      const sample = await impatient.download(server.url);

      assert.equal(sample.bytes, 5 * CHUNK.length);
      assert.ok(sample.durationMs >= 200);
    });
  });

  describe('network failures', () => {
    it('reports a refused connection', async () => {
      const server = await startServer(() => {
        // Closed before any request.
      });
      const { url } = server;
      await server[Symbol.asyncDispose]();

      await assert.rejects(downloader.download(url), (error: unknown) => {
        assert.ok(error instanceof NetworkError);
        assert.match(
          error.message,
          /^Network error: the server refused the connection \(.*ECONNREFUSED/,
        );
        return true;
      });
    });

    it('points to the internet connection when the host cannot be resolved', async () => {
      // The .invalid TLD is reserved and guaranteed never to resolve (RFC 2606) — the same
      // failure a hostname gets when the machine is offline from the start.
      await assert.rejects(
        downloader.download(new URL('http://speedtest.invalid/')),
        (error: unknown) => {
          assert.ok(error instanceof NetworkError);
          // EAI_AGAIN instead of ENOTFOUND when the machine has no DNS at all.
          assert.match(
            error.message,
            /^Network error: could not resolve the host name — check the URL and your internet connection \(getaddrinfo (ENOTFOUND|EAI_AGAIN) speedtest\.invalid\)$/,
          );
          return true;
        },
      );
    });

    it('fails instead of counting a partial body when the connection drops mid-body', async () => {
      await using server = await startServer((_request, response) => {
        // Announce the full size, deliver only part of it, then lose the connection.
        response.writeHead(200, { 'content-length': 4 * CHUNK.length });
        response.write(CHUNK);
        response.destroy();
      });

      await assert.rejects(downloader.download(server.url), (error: unknown) => {
        assert.ok(error instanceof NetworkError);
        assert.match(error.message, /^Network error: the connection was lost/);
        return true;
      });
    });

    it('fails when a chunked body is cut off', async () => {
      await using server = await startServer((_request, response) => {
        response.write(CHUNK);
        response.destroy();
      });

      await assert.rejects(downloader.download(server.url), NetworkError);
    });

    it('recovers when the kept-alive connection died between requests', async () => {
      await using server = await startServer((_request, response) => {
        response.end(CHUNK);
        // Drop the socket right after a successful response, as a flaky network would.
        response.once('finish', () => response.socket?.destroy());
      });

      const first = await downloader.download(server.url);
      const second = await downloader.download(server.url);

      assert.equal(first.bytes, CHUNK.length);
      assert.equal(second.bytes, CHUNK.length);
    });
  });
});
