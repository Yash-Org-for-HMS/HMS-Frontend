import { useCallback, useState } from "react";

/**
 * Page state for a report that fetches one page at a time.
 *
 * The only thing here that is not bookkeeping is `onFilterChange`. A reader on
 * page 40 who narrows the date range now has three pages of results and is
 * looking at an empty table, which reads as a broken report rather than as
 * "you moved". Every filter a report owns should go through it.
 *
 * `params` is spread straight into the request. Sending `page` at all is what
 * asks the server for a page — omit it and the endpoints return the whole
 * report, which is how the exports get everything.
 *
 * `prefix` is for a report that returns TWO detail lists (the lab register's
 * lab and radiology halves; the nurse report's vitals and abnormal readings).
 * One shared `page` would move both tables at once, so each list gets its own
 * hook with its own key pair — `labPage`/`labLimit`, `radPage`/`radLimit` —
 * matching what pageRows() reads on the server.
 */
export function useReportPaging({ size = 100, prefix }: { size?: number; prefix?: string } = {}) {
  const [page, setPage] = useState(0);          // zero-based, as MUI counts
  const [pageSize, setPageSize] = useState(size);
  const pageKey = prefix ? `${prefix}Page` : "page";
  const limitKey = prefix ? `${prefix}Limit` : "limit";

  /** Wrap a filter's setter so changing it returns to the first page. */
  const onFilterChange = useCallback(
    <T,>(set: (value: T) => void) => (value: T) => { setPage(0); set(value); },
    [],
  );

  return {
    page,
    pageSize,
    /** Query params for the request — server pages are 1-based. */
    params: { [pageKey]: page + 1, [limitKey]: pageSize } as Record<string, number>,
    onPageChange: setPage,
    onPageSizeChange: useCallback((size: number) => { setPageSize(size); setPage(0); }, []),
    onFilterChange,
    /** Everything ReportTable's `pagination` prop needs, bar the row count. */
    bind: (totalRows: number, busy?: boolean) => ({
      page, pageSize, totalRows, busy,
      onPageChange: setPage,
      onPageSizeChange: (size: number) => { setPageSize(size); setPage(0); },
    }),
  };
}
