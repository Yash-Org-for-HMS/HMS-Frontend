import { useMemo, useState } from "react";

export type SortOrder = "asc" | "desc";

type SortValue = string | number | Date | null | undefined;
type Accessor<T> = (row: T) => SortValue;

/**
 * Client-side column sorting for tables whose FULL dataset is already loaded in
 * memory (e.g. lists fetched in one shot and filtered with useMemo). Do NOT use
 * this on server-paginated lists — it would only reorder the current page and
 * mislead the user.
 *
 * Pass a map of column-key -> value accessor. Clicking a column toggles
 * asc/desc; clicking a new column starts at asc. Nulls always sort last.
 *
 * `accessors` is read fresh on each sort but intentionally kept out of the memo
 * deps — the accessor logic is pure/stable, so a cached result computed with an
 * earlier (identical) closure is still correct.
 */
export function useTableSort<T>(
  rows: T[],
  accessors: Record<string, Accessor<T>>,
  initial?: { key: string; order?: SortOrder },
) {
  const [orderBy, setOrderBy] = useState<string | null>(initial?.key ?? null);
  const [order, setOrder] = useState<SortOrder>(initial?.order ?? "asc");

  const onSort = (key: string) => {
    if (orderBy === key) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setOrderBy(key);
      setOrder("asc");
    }
  };

  const norm = (v: SortValue): string | number | null => {
    if (v == null) return null;
    if (v instanceof Date) return v.getTime();
    if (typeof v === "string") return v.toLowerCase();
    return v;
  };

  const sorted = useMemo(() => {
    const accessor = orderBy ? accessors[orderBy] : null;
    if (!accessor) return rows;
    const dir = order === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = norm(accessor(a));
      const vb = norm(accessor(b));
      if (va === vb) return 0;
      // Nulls/blanks always sink to the bottom regardless of direction.
      if (va === null) return 1;
      if (vb === null) return -1;
      return va < vb ? -1 * dir : 1 * dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, orderBy, order]);

  return { sorted, orderBy, order, onSort };
}

/**
 * Sort-state controller for SERVER-paginated lists. It only tracks which column
 * and direction are active (toggling asc/desc on click) — feed `orderBy`/`order`
 * into your query params (as sortBy/sortOrder) and let the backend do the
 * ordering across the full dataset. Pairs with SortableHeadCell.
 */
export function useServerSort(initial?: { key: string; order?: SortOrder }) {
  const [orderBy, setOrderBy] = useState<string | null>(initial?.key ?? null);
  const [order, setOrder] = useState<SortOrder>(initial?.order ?? "asc");

  const onSort = (key: string) => {
    if (orderBy === key) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setOrderBy(key);
      setOrder("asc");
    }
  };

  return { orderBy, order, onSort };
}
