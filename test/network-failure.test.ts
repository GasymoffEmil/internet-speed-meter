import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeNetworkFailure } from '../src/network-failure.ts';

/** Mimics what fetch throws: a generic TypeError wrapping the real Node/undici error. */
function fetchFailure(code: string, message: string): TypeError {
  const cause = Object.assign(new Error(message), { code });
  return new TypeError('fetch failed', { cause });
}

describe('describeNetworkFailure', () => {
  it('explains that there is no internet when the host cannot be resolved', () => {
    assert.equal(
      describeNetworkFailure(fetchFailure('EAI_AGAIN', 'getaddrinfo EAI_AGAIN example.com')),
      'Network error: could not resolve the host name — check the URL and your internet ' +
        'connection (getaddrinfo EAI_AGAIN example.com)',
    );
  });

  it('explains an unreachable network', () => {
    assert.equal(
      describeNetworkFailure(fetchFailure('ENETUNREACH', 'connect ENETUNREACH 1.2.3.4:443')),
      'Network error: the network is unreachable — check your internet connection ' +
        '(connect ENETUNREACH 1.2.3.4:443)',
    );
  });

  it('explains a connection lost midway and adds the code missing from the message', () => {
    assert.equal(
      describeNetworkFailure(fetchFailure('UND_ERR_SOCKET', 'other side closed')),
      'Network error: the connection was lost — check your internet connection ' +
        '(UND_ERR_SOCKET: other side closed)',
    );
  });

  it('falls back to the raw details for unknown codes', () => {
    assert.equal(
      describeNetworkFailure(fetchFailure('ERR_TLS_CERT_ALTNAME_INVALID', 'Hostname mismatch')),
      'Network error: ERR_TLS_CERT_ALTNAME_INVALID: Hostname mismatch',
    );
  });

  it('uses the code when the message is empty, as with AggregateError from multi-address connects', () => {
    const cause = Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' });

    assert.equal(
      describeNetworkFailure(new TypeError('fetch failed', { cause })),
      'Network error: the server refused the connection (ECONNREFUSED)',
    );
  });

  it('handles errors without a cause and non-error values', () => {
    assert.equal(describeNetworkFailure(new Error('boom')), 'Network error: boom');
    assert.equal(describeNetworkFailure('boom'), 'Network error: boom');
  });

  it('never produces an empty description', () => {
    assert.equal(
      describeNetworkFailure(new TypeError('fetch failed', { cause: new RangeError('') })),
      'Network error: RangeError',
    );
  });
});
