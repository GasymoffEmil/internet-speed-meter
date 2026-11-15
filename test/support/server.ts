import { createServer, type RequestListener } from 'node:http';

export interface TestServer extends AsyncDisposable {
  readonly url: URL;
}

/** Starts an HTTP server on a random local port; dispose it to shut it down. */
export async function startServer(handler: RequestListener): Promise<TestServer> {
  const server = createServer(handler);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error(`Expected a TCP address, got ${String(address)}`);
  }

  return {
    url: new URL(`http://127.0.0.1:${String(address.port)}/`),
    async [Symbol.asyncDispose]() {
      // Tests deliberately leave some responses hanging; drop them instead of waiting.
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}
