import type { Issue } from "@/lib/issues";

function formatAssignee(assignee: string | null): string {
  return assignee ?? "Unassigned";
}

export function IssueList({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <div
        data-testid="empty-state"
        className="rounded border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400"
      >
        No issues match the current filters.
      </div>
    );
  }

  return (
    <ul data-testid="issue-list" className="flex flex-col gap-2">
      {issues.map((issue) => (
        <li
          key={issue.id}
          data-testid={`issue-item-${issue.id}`}
          className="rounded border border-gray-200 p-3 dark:border-gray-700"
        >
          <p className="font-medium">{issue.title}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {issue.status} · {formatAssignee(issue.assignee)}
            {issue.labels.length > 0 ? ` · ${issue.labels.join(", ")}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
