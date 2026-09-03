export interface WorkflowRun {
  id: number;
  display_title: string;
  created_at: string;
  conclusion: string | null;
}

interface WorkflowRunsPage {
  workflow_runs?: unknown;
}

function isWorkflowRun(value: unknown): value is WorkflowRun {
  if (!value || typeof value !== 'object') return false;
  const run = value as Record<string, unknown>;
  return (
    typeof run.id === 'number' &&
    Number.isSafeInteger(run.id) &&
    run.id > 0 &&
    typeof run.display_title === 'string' &&
    typeof run.created_at === 'string' &&
    (typeof run.conclusion === 'string' || run.conclusion === null)
  );
}

/** Parse one page emitted by `gh api`. */
export function parseWorkflowRuns(output: string): WorkflowRun[] {
  const page: unknown = JSON.parse(output);
  if (!page || typeof page !== 'object') {
    throw new Error('GitHub returned an unexpected response');
  }

  const runs = (page as WorkflowRunsPage).workflow_runs;
  if (!Array.isArray(runs)) throw new Error('GitHub returned an unexpected response');
  return runs.filter(isWorkflowRun);
}

export function matchingWorkflowRuns(runs: WorkflowRun[], keyword: string): WorkflowRun[] {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  if (!normalizedKeyword) return [];

  return runs
    .filter(
      (run) =>
        run.conclusion === 'success' &&
        run.display_title.toLocaleLowerCase().includes(normalizedKeyword),
    )
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));
}
