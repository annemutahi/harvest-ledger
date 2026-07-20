import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";
export type Accessor<T> = (row: T) => unknown;

export interface TableViewOptions<T> {
  data: T[];
  accessors: Record<string, Accessor<T>>;
  defaultSort?: { key: string; dir?: SortDir };
  defaultPageSize?: number;
}

export interface TableView<T> {
  sortKey: string | null;
  sortDir: SortDir;
  toggleSort: (key: string) => void;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (s: number) => void;
  total: number;
  pageCount: number;
  sorted: T[];
  paged: T[];
  from: number;
  to: number;
}

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const da = new Date(a as string);
  const db = new Date(b as string);
  if (typeof a === "string" && typeof b === "string" && !isNaN(da.getTime()) && !isNaN(db.getTime()) && /\d{4}-\d{2}-\d{2}/.test(a)) {
    return da.getTime() - db.getTime();
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function useTableView<T>({
  data,
  accessors,
  defaultSort,
  defaultPageSize = 25,
}: TableViewOptions<T>): TableView<T> {
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(defaultSort?.dir ?? "asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const acc = accessors[sortKey];
    if (!acc) return data;
    const copy = [...data];
    copy.sort((x, y) => {
      const r = cmp(acc(x), acc(y));
      return sortDir === "asc" ? r : -r;
    });
    return copy;
  }, [data, sortKey, sortDir, accessors]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(total, safePage * pageSize);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  return {
    sortKey,
    sortDir,
    toggleSort,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    total,
    pageCount,
    sorted,
    paged,
    from,
    to,
  };
}
