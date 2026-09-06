import issuesData from "@/data/issues.json";

export type IssueStatus = "open" | "in-progress" | "done";

export interface Issue {
  id: string;
  title: string;
  status: IssueStatus;
  assignee: string | null;
  labels: string[];
  createdAt: string;
}

export const ISSUE_STATUSES: readonly IssueStatus[] = ["open", "in-progress", "done"];

/** The on-disk data is a trusted fixture, not user input, so it is cast once here. */
const ALL_ISSUES = issuesData as Issue[];

export function getIssues(): Issue[] {
  return ALL_ISSUES;
}

/** Every label present in the data, sorted alphabetically. Useful for rendering filter options. */
export function getAllLabels(): string[] {
  const labels = new Set<string>();
  for (const issue of ALL_ISSUES) {
    for (const label of issue.labels) {
      labels.add(label);
    }
  }
  return Array.from(labels).sort();
}

/** Every distinct assignee present in the data, sorted alphabetically. Excludes unassigned issues. */
export function getAllAssignees(): string[] {
  const assignees = new Set<string>();
  for (const issue of ALL_ISSUES) {
    if (issue.assignee) {
      assignees.add(issue.assignee);
    }
  }
  return Array.from(assignees).sort();
}

export function filterByStatus(issues: Issue[], status: IssueStatus | null): Issue[] {
  if (status === null) {
    return issues;
  }
  return issues.filter((issue) => issue.status === status);
}

// Extension points for filters that do not exist yet (see the fixture README for the
// full data-testid and URL query-param convention each one should follow):
//
// filterByLabels(issues, labels: string[]): Issue[]
//   An issue matches when `issue.labels` shares at least one entry with `labels`.
//   An empty `labels` array means "no label filter applied" (return `issues` unchanged).
//
// filterByAssignee(issues, assignee: string | null): Issue[]
//   `assignee === "unassigned"` matches issues where `issue.assignee === null`.
//   `assignee === null` means "no assignee filter applied" (return `issues` unchanged).
//
// filterBySearch(issues, query: string): Issue[]
//   Case-insensitive substring match of `query` against `issue.title`.
//   An empty/blank `query` means "no search filter applied" (return `issues` unchanged).
//
// Each should be a small, pure function here in lib/issues.ts, mirroring filterByStatus,
// and composed together by app/page.tsx the same way it already composes filterByStatus.
