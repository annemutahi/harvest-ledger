import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TableView } from "@/hooks/use-table-view";

interface SortableHeadProps<T> {
  ctrl: TableView<T>;
  sortKey: string;
  className?: string;
  align?: "left" | "right";
  children: ReactNode;
}

export function SortableHead<T>({ ctrl, sortKey, className, align = "left", children }: SortableHeadProps<T>) {
  const active = ctrl.sortKey === sortKey;
  const Icon = !active ? ChevronsUpDown : ctrl.sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <TableHead className={cn(align === "right" && "text-right", className)}>
      <button
        type="button"
        onClick={() => ctrl.toggleSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 select-none text-inherit font-inherit hover:text-foreground transition-colors",
          align === "right" && "flex-row-reverse w-full justify-start",
          !active && "text-muted-foreground",
        )}
        aria-sort={active ? (ctrl.sortDir === "asc" ? "ascending" : "descending") : "none"}
      >
        <span>{children}</span>
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </button>
    </TableHead>
  );
}

interface TablePaginationProps<T> {
  ctrl: TableView<T>;
  label?: string;
  pageSizeOptions?: number[];
}

export function TablePagination<T>({ ctrl, label = "rows", pageSizeOptions = [10, 25, 50, 100] }: TablePaginationProps<T>) {
  if (ctrl.total === 0) return null;
  return (
    <div className="flex flex-col-reverse items-start gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between print:hidden">
      <div>
        Showing <span className="font-medium text-foreground">{ctrl.from}</span>–
        <span className="font-medium text-foreground">{ctrl.to}</span> of{" "}
        <span className="font-medium text-foreground">{ctrl.total}</span> {label}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">Rows per page</span>
          <Select value={String(ctrl.pageSize)} onValueChange={(v) => { ctrl.setPageSize(Number(v)); ctrl.setPage(1); }}>
            <SelectTrigger className="h-8 w-[76px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => ctrl.setPage(1)} disabled={ctrl.page <= 1} aria-label="First page">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => ctrl.setPage(ctrl.page - 1)} disabled={ctrl.page <= 1} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 tabular-nums">
            Page <span className="font-medium text-foreground">{ctrl.page}</span> / {ctrl.pageCount}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => ctrl.setPage(ctrl.page + 1)} disabled={ctrl.page >= ctrl.pageCount} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => ctrl.setPage(ctrl.pageCount)} disabled={ctrl.page >= ctrl.pageCount} aria-label="Last page">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
