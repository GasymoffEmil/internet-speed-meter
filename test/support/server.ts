import { createServer, type RequestListener, type Server } from 'node:http';
import {
  createSecureServer,
  type Http2SecureServer,
  type Http2ServerRequest,
  type Http2ServerResponse,
} from 'node:http2';
import type { Socket } from 'node:net';

export interface TestServer extends AsyncDisposable {
  readonly url: URL;
}

export interface TlsCredentials {
  readonly key: Buffer;
  readonly cert: Buffer;
}

/** Starts an HTTP/1.1 server on a random local port; dispose it to shut it down. */
export async function startServer(handler: RequestListener): Promise<TestServer> {
  const server = createServer(handler);
  return listen(server, 'http:', () => {
    server.closeAllConnections();
  });
}

/** Starts an HTTPS server that prefers HTTP/2 via ALPN but also accepts HTTP/1.1, like most CDNs. */
export async function startHttp2Server(
  tls: TlsCredentials,
  handler: (request: Http2ServerRequest, response: Http2ServerResponse) => void,
): Promise<TestServer> {
  const server = createSecureServer({ ...tls, allowHTTP1: true }, handler);
  const sockets = new Set<Socket>();
  server.on('secureConnection', (socket: Socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  return listen(server, 'https:', () => {
    for (const socket of sockets) socket.destroy();
  });
}

async function listen(
  server: Server | Http2SecureServer,
  protocol: 'http:' | 'https:',
  dropConnections: () => void,
): Promise<TestServer> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error(`Expected a TCP address, got ${String(address)}`);
  }

  return {
    url: new URL(`${protocol}//127.0.0.1:${String(address.port)}/`),
    async [Symbol.asyncDispose]() {
      // Tests deliberately leave some responses hanging; drop them instead of waiting.
      dropConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}
