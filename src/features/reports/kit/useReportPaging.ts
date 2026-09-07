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
 */
export function useReportPaging(initialSize = 100) {
  const [page, setPage] = useState(0);          // zero-based, as MUI counts
  const [pageSize, setPageSize] = useState(initialSize);

  /** Wrap a filter's setter so changing it returns to the first page. */
  const onFilterChange = useCallback(
    <T,>(set: (value: T) => void) => (value: T) => { setPage(0); set(value); },
    [],
  );

  return {
    page,
    pageSize,
    /** Query params for the request — server pages are 1-based. */
    params: { page: page + 1, limit: pageSize },
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
