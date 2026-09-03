import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';

import {
  matchingWorkflowRuns,
  parseWorkflowRuns,
  type WorkflowRun,
} from './lib/dispatch-ingest-runs';

/** Number of recent days to search. Change this value when a wider window is needed. */
const LOOKBACK_DAYS = 7;

const SOURCE_REPO = 'skymizer/InferenceX';
const DISPATCH_REPO = 'skymizerFuji/InferenceX-app';
const EVENT_TYPE = 'ingest-results';

function runGh(args: string[], stdio: 'pipe' | 'inherit' = 'pipe'): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', args, { stdio });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `gh exited with status ${code ?? 'unknown'}`));
    });
  });
}

const keyword = process.argv.slice(2).join(' ').trim();
if (!keyword) {
  console.error('Usage: bun run admin:db:dispatch-ingest <keyword>');
  process.exit(1);
}

const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  .toISOString()
  .replace(/\.\d{3}Z$/, 'Z');
console.log(`Searching ${SOURCE_REPO} runs from the last ${LOOKBACK_DAYS} days for “${keyword}”…`);

const fetchedRuns: WorkflowRun[] = [];
for (let page = 1; ; page++) {
  const output = await runGh([
    'api',
    '--method',
    'GET',
    `repos/${SOURCE_REPO}/actions/runs`,
    '-f',
    'per_page=100',
    '-f',
    `page=${page}`,
    '-f',
    `created=>=${since}`,
  ]);
  const pageRuns = parseWorkflowRuns(output);
  fetchedRuns.push(...pageRuns);
  if (pageRuns.length < 100) break;
}
const runs = matchingWorkflowRuns(fetchedRuns, keyword);

if (runs.length === 0) {
  console.log('No matching workflow runs found.');
  process.exit(0);
}

console.table(
  runs.map((run) => ({ id: run.id, title: run.display_title, created_at: run.created_at })),
);

const prompt = createInterface({ input: process.stdin, output: process.stdout });
const answer = await prompt.question(`Dispatch ingest for all ${runs.length} runs? [y/N] `);
prompt.close();

if (answer.trim().toLocaleLowerCase() !== 'y') {
  console.log('Cancelled.');
  process.exit(0);
}

let succeeded = 0;
const failed: number[] = [];
for (const [index, run] of runs.entries()) {
  console.log(`[${index + 1}/${runs.length}] Dispatching run ${run.id}: ${run.display_title}`);
  try {
    await runGh(
      [
        'api',
        '--method',
        'POST',
        `repos/${DISPATCH_REPO}/dispatches`,
        '-f',
        `event_type=${EVENT_TYPE}`,
        '-F',
        `client_payload[run-id]=${run.id}`,
      ],
      'inherit',
    );
    succeeded++;
  } catch (error) {
    failed.push(run.id);
    console.error(
      `Failed to dispatch run ${run.id}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

console.log(`Done: ${succeeded} succeeded, ${failed.length} failed.`);
if (failed.length > 0) {
  console.error(`Failed run IDs: ${failed.join(', ')}`);
  process.exitCode = 1;
}
