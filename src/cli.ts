import { parseCommand, USAGE, type Command } from './config.ts';
import { createFetchDownloader } from './downloader.ts';
import { DownloadError, UsageError } from './errors.ts';
import { formatSample, formatSummary } from './format.ts';
import { runMeasurements } from './measurement.ts';
import { summarize } from './stats.ts';

const EXIT_OK = 0;
const EXIT_DOWNLOAD_FAILED = 1;
const EXIT_USAGE = 2;

async function main(args: readonly string[]): Promise<number> {
  let command: Command;
  try {
    command = parseCommand(args);
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`Error: ${error.message}\n\n${USAGE}`);
      return EXIT_USAGE;
    }
    throw error;
  }

  if (command.kind === 'help') {
    console.log(USAGE);
    return EXIT_OK;
  }

  const { url, count, idleTimeoutMs } = command.config;
  console.log(`Downloading ${url.href} ${String(count)} ${count === 1 ? 'time' : 'times'}...\n`);

  let completed = 0;
  try {
    const samples = await runMeasurements({
      downloader: createFetchDownloader({ idleTimeoutMs }),
      url,
      count,
      onSample: (sample, index) => {
        completed = index;
        console.log(formatSample(sample, index, count));
      },
    });
    console.log(`\n${formatSummary(summarize(samples))}`);
    return EXIT_OK;
  } catch (error) {
    if (error instanceof DownloadError) {
      console.error(`Request ${String(completed + 1)}/${String(count)} failed: ${error.message}`);
      return EXIT_DOWNLOAD_FAILED;
    }
    throw error;
  }
}

process.exitCode = await main(process.argv.slice(2));
