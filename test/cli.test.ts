import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { startServer } from './support/server.ts';

const CLI_PATH = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

interface CliResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs the CLI as a real child process, exactly as a user would. */
async function runCli(args: readonly string[]): Promise<CliResult> {
  const child = spawn(process.execPath, [CLI_PATH, ...args]);
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  return { exitCode, stdout, stderr };
}

describe('cli', () => {
  it('measures the URL and prints per-request lines and a summary', async () => {
    await using server = await startServer((_request, response) => {
      response.end(Buffer.alloc(250_000));
    });

    const result = await runCli([server.url.href, '--count', '3']);

    assert.equal(result.exitCode, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /^Downloading .+ 3 times\.\.\.$/m);
    assert.match(result.stdout, /^Request 1\/3: .+ ms, 250\.00 kB$/m);
    assert.match(result.stdout, /^Request 3\/3: /m);
    assert.doesNotMatch(result.stdout, /Request 4\//);
    assert.match(result.stdout, /^Requests: +3$/m);
    assert.match(result.stdout, /^Downloaded: +750\.00 kB$/m);
    assert.match(result.stdout, /^Download speed: +[\d,.]+ Mbit\/s \([\d,.]+ MB\/s\)$/m);
  });

  it('uses singular wording for a single request', async () => {
    await using server = await startServer((_request, response) => {
      response.end('x');
    });

    const result = await runCli([server.url.href, '-n', '1']);

    assert.equal(result.exitCode, 0, result.stderr);
    assert.match(result.stdout, /^Downloading .+ 1 time\.\.\.$/m);
  });

  it('rejects a URL with embedded credentials without echoing them', async () => {
    const result = await runCli(['https://user:top-secret@example.com/file']);

    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /URLs with embedded credentials .* are not supported/);
    assert.doesNotMatch(result.stdout + result.stderr, /top-secret/);
  });

  it('exits with 1 and names the failed request', async () => {
    let requests = 0;
    await using server = await startServer((_request, response) => {
      requests += 1;
      response.statusCode = requests === 2 ? 503 : 200;
      response.end('x');
    });

    const result = await runCli([server.url.href]);

    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Request 2\/10 failed: Server responded with HTTP 503/);
    assert.doesNotMatch(result.stdout, /Download speed/);
  });

  it('exits with 2 and prints usage on invalid arguments', async () => {
    const result = await runCli(['--count', '0', 'https://example.com']);

    assert.equal(result.exitCode, 2);
    assert.match(result.stderr, /--count must be a positive integer/);
    assert.match(result.stderr, /Usage: speedtest <url>/);
  });

  it('prints usage on --help', async () => {
    const result = await runCli(['--help']);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Usage: speedtest <url>/);
  });
});
