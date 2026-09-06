import { IssueList } from "@/components/IssueList";
import { StatusFilter } from "@/components/StatusFilter";
import { filterByStatus, getIssues, type IssueStatus } from "@/lib/issues";

const VALID_STATUSES = new Set<IssueStatus>(["open", "in-progress", "done"]);

function parseStatus(value: string | string[] | undefined): IssueStatus | null {
  if (typeof value !== "string") {
    return null;
  }
  return VALID_STATUSES.has(value as IssueStatus) ? (value as IssueStatus) : null;
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = parseStatus(params.status);

  const issues = filterByStatus(getIssues(), status);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Issue board</h1>
      <div className="flex flex-wrap gap-4">
        <StatusFilter />
      </div>
      <IssueList issues={issues} />
    </main>
  );
}
