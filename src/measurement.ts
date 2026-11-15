import type { Downloader } from './downloader.ts';
import type { Sample } from './sample.ts';

export interface MeasurementOptions {
  readonly downloader: Downloader;
  readonly url: URL;
  readonly count: number;
  /** Called after each completed download; `index` is 1-based. */
  readonly onSample?: (sample: Sample, index: number) => void;
}

/** Downloads `url` `count` times strictly one after another, so requests never compete for bandwidth. */
export async function runMeasurements(options: MeasurementOptions): Promise<Sample[]> {
  const samples: Sample[] = [];
  for (let index = 1; index <= options.count; index += 1) {
    const sample = await options.downloader.download(options.url);
    samples.push(sample);
    options.onSample?.(sample, index);
  }
  return samples;
}
