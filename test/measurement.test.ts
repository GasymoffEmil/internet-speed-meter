import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import type { Downloader } from '../src/downloader.ts';
import { NetworkError } from '../src/errors.ts';
import { runMeasurements } from '../src/measurement.ts';
import type { Sample } from '../src/sample.ts';

const URL_UNDER_TEST = new URL('https://example.com/file');

describe('runMeasurements', () => {
  it('downloads the given number of times, never concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    const requested: URL[] = [];
    const downloader: Downloader = {
      async download(url) {
        requested.push(url);
        active += 1;
        maxActive = Math.max(maxActive, active);
        await delay(5);
        active -= 1;
        return { bytes: requested.length * 100, durationMs: 5 };
      },
    };

    const samples = await runMeasurements({ downloader, url: URL_UNDER_TEST, count: 3 });

    assert.equal(maxActive, 1);
    assert.deepEqual(requested, [URL_UNDER_TEST, URL_UNDER_TEST, URL_UNDER_TEST]);
    assert.deepEqual(
      samples.map((sample) => sample.bytes),
      [100, 200, 300],
    );
  });

  it('reports each sample with its 1-based index as soon as it completes', async () => {
    const reported: [Sample, number][] = [];
    const downloader: Downloader = {
      download: () => Promise.resolve({ bytes: 1, durationMs: 1 }),
    };

    await runMeasurements({
      downloader,
      url: URL_UNDER_TEST,
      count: 2,
      onSample: (sample, index) => reported.push([sample, index]),
    });

    assert.deepEqual(
      reported.map(([, index]) => index),
      [1, 2],
    );
  });

  it('stops at the first failed download', async () => {
    let calls = 0;
    const downloader: Downloader = {
      download: () => {
        calls += 1;
        return calls === 2
          ? Promise.reject(new NetworkError('boom'))
          : Promise.resolve({ bytes: 1, durationMs: 1 });
      },
    };

    await assert.rejects(
      runMeasurements({ downloader, url: URL_UNDER_TEST, count: 5 }),
      NetworkError,
    );
    assert.equal(calls, 2);
  });
});
