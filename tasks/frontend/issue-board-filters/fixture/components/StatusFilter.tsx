"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ChangeEvent } from "react";
import { ISSUE_STATUSES, type IssueStatus } from "@/lib/issues";

const STATUS_LABELS: Record<IssueStatus, string> = {
  open: "Open",
  "in-progress": "In progress",
  done: "Done",
};

export function StatusFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "";

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("status", value);
    } else {
      params.delete("status");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="filter-status-select" className="text-sm font-medium">
        Status
      </label>
      <select
        id="filter-status-select"
        data-testid="filter-status"
        value={currentStatus}
        onChange={handleChange}
        className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
      >
        <option value="">All statuses</option>
        {ISSUE_STATUSES.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
}
