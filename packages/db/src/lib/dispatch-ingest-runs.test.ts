import { describe, expect, it } from 'vitest';

import { matchingWorkflowRuns, parseWorkflowRuns } from './dispatch-ingest-runs';

describe('parseWorkflowRuns', () => {
  it('parses a gh response page and ignores malformed entries', () => {
    const output = JSON.stringify({
      workflow_runs: [
        {
          id: 101,
          display_title: '5090 vLLM',
          created_at: '2026-09-01T12:00:00Z',
          conclusion: 'success',
        },
        {
          id: 'bad',
          display_title: '5090 invalid',
          created_at: '2026-09-01T13:00:00Z',
          conclusion: 'success',
        },
        {
          id: 102,
          display_title: 'B200 SGLang',
          created_at: '2026-08-31T12:00:00Z',
          conclusion: 'failure',
        },
      ],
    });

    expect(parseWorkflowRuns(output).map((run) => run.id)).toEqual([101, 102]);
  });

  it('rejects a response without workflow runs', () => {
    expect(() => parseWorkflowRuns('{}')).toThrow('unexpected response');
  });
});

describe('matchingWorkflowRuns', () => {
  const runs = [
    {
      id: 1,
      display_title: 'RTX 5090 nightly',
      created_at: '2026-08-31T12:00:00Z',
      conclusion: 'success',
    },
    {
      id: 2,
      display_title: '5090 SGLang',
      created_at: '2026-09-01T12:00:00Z',
      conclusion: 'success',
    },
    {
      id: 3,
      display_title: 'B200 nightly',
      created_at: '2026-09-02T12:00:00Z',
      conclusion: 'success',
    },
    {
      id: 4,
      display_title: '5090 failed',
      created_at: '2026-09-02T13:00:00Z',
      conclusion: 'failure',
    },
    {
      id: 5,
      display_title: '5090 still running',
      created_at: '2026-09-02T14:00:00Z',
      conclusion: null,
    },
  ];

  it('matches case-insensitively and sorts newest first', () => {
    expect(matchingWorkflowRuns(runs, ' 5090 ').map((run) => run.id)).toEqual([2, 1]);
  });

  it('does not treat an empty keyword as matching every run', () => {
    expect(matchingWorkflowRuns(runs, '   ')).toEqual([]);
  });

  it('only returns successfully completed runs', () => {
    expect(matchingWorkflowRuns(runs, '5090').map((run) => run.id)).toEqual([2, 1]);
  });
});
