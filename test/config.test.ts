import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCommand } from '../src/config.ts';
import { UsageError } from '../src/errors.ts';

describe('parseCommand', () => {
  it('applies defaults when only the URL is given', () => {
    assert.deepEqual(parseCommand(['https://example.com/image.jpg']), {
      kind: 'measure',
      config: {
        url: new URL('https://example.com/image.jpg'),
        count: 10,
        idleTimeoutMs: 30_000,
      },
    });
  });

  it('reads count and timeout in long and short forms', () => {
    const expected = {
      kind: 'measure',
      config: { url: new URL('http://example.com/'), count: 3, idleTimeoutMs: 1500 },
    };

    assert.deepEqual(
      parseCommand(['http://example.com/', '--count', '3', '--timeout', '1.5']),
      expected,
    );
    assert.deepEqual(parseCommand(['-n', '3', '-t', '1.5', 'http://example.com/']), expected);
  });

  it('recognizes help even without a URL', () => {
    assert.deepEqual(parseCommand(['--help']), { kind: 'help' });
    assert.deepEqual(parseCommand(['-h']), { kind: 'help' });
  });

  it('rejects invalid input with a usage error', () => {
    const invalid: readonly (readonly string[])[] = [
      [],
      ['https://a.example', 'https://b.example'],
      ['not a url'],
      ['ftp://example.com/file'],
      ['https://user:secret@example.com/file'],
      ['https://token@example.com/file'],
      ['https://example.com', '--count', '0'],
      ['https://example.com', '--count', '-1'],
      ['https://example.com', '--count', '1.5'],
      ['https://example.com', '--count', 'ten'],
      ['https://example.com', '--count', ''],
      ['https://example.com', '--timeout', '0'],
      ['https://example.com', '--timeout', 'soon'],
      ['https://example.com', '--timeout', ''],
      ['https://example.com', '--timeout', '1e9'],
      ['https://example.com', '--timeout', '1e1'],
      ['https://example.com', '--timeout', '0x10'],
      ['https://example.com', '--timeout', ' 5'],
      ['https://example.com', '--timeout', '5.'],
      ['https://example.com', '--timeout', '3000000'],
      ['https://example.com', '--unknown'],
      ['https://example.com', '--count'],
    ];
    for (const args of invalid) {
      assert.throws(() => parseCommand(args), UsageError, JSON.stringify(args));
    }
  });
});
