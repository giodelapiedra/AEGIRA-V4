import { useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  SortingState,
  getSortedRowModel,
  ColumnFiltersState,
  getFilteredRowModel,
  PaginationState,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Inbox,
} from 'lucide-react';
import { PAGINATION } from '@/lib/constants';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  // Server-side pagination
  pageCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: (pagination: PaginationState) => void;
  // Features
  searchable?: boolean;
  searchPlaceholder?: string;
  searchColumn?: string;
  // Loading state
  isLoading?: boolean;
  // Empty state
  emptyMessage?: string;
  // Total count for display
  totalCount?: number;
  // Row click handler
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  pageCount,
  pagination,
  onPaginationChange,
  searchable = false,
  searchPlaceholder = 'Filter...',
  searchColumn,
  isLoading = false,
  emptyMessage = 'No results found.',
  totalCount,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Determine if using server-side or client-side pagination
  const isServerSide = pagination !== undefined && onPaginationChange !== undefined;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Client-side pagination (when not using server-side)
    ...(!isServerSide && { getPaginationRowModel: getPaginationRowModel() }),
    // Server-side pagination
    ...(isServerSide && {
      pageCount: pageCount ?? -1,
      onPaginationChange: (updater) => {
        const newPagination =
          typeof updater === 'function' ? updater(pagination!) : updater;
        onPaginationChange!(newPagination);
      },
      manualPagination: true,
    }),
    // Sorting
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    // Filtering
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    // State - unified for both modes
    state: isServerSide
      ? { pagination, sorting, columnFilters }
      : { sorting, columnFilters },
  });

  const displayTotal = totalCount ?? table.getFilteredRowModel().rows.length;
  const rowCount = table.getRowModel().rows.length;

  return (
    <div className="space-y-4">
      {/* Search - full width on mobile */}
      {searchable && searchColumn && (
        <div className="flex items-center gap-4">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={(table.getColumn(searchColumn)?.getFilterValue() as string) ?? ''}
              onChange={(e) =>
                table.getColumn(searchColumn)?.setFilterValue(e.target.value)
              }
              className="h-9 border-border/70 pl-9"
              aria-label="Search table records"
            />
          </div>
        </div>
      )}

      {/* Table with horizontal scroll on mobile */}
      <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as { className?: string } | undefined;
                    return (
                      <TableHead
                        key={header.id}
                        className={`whitespace-nowrap ${meta?.className || ''}`}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="[&_tr:nth-child(even)]:bg-muted/[0.18]">
              {isLoading ? (
                // Loading skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full max-w-[200px] animate-pulse rounded bg-muted/70" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rowCount ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={onRowClick ? 'cursor-pointer' : undefined}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as { className?: string } | undefined;
                      return (
                        <TableCell key={cell.id} className={meta?.className || ''}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length}
                    className="h-40 py-10 text-center"
                  >
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-muted-foreground">
                      <div className="rounded-full bg-muted p-2.5">
                        <Inbox className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
                      <p className="text-xs">Try adjusting your search or filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination - responsive */}
      <DataTablePagination table={table} totalCount={displayTotal} />
    </div>
  );
}

// Sortable header helper with proper sort indicator
export function SortableHeader<TData>({
  column,
  children,
}: {
  column: import('@tanstack/react-table').Column<TData, unknown>;
  children: React.ReactNode;
}) {
  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      className="-ml-3 h-8 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground focus-visible:ring-1"
      aria-label={`Sort by ${String(children)}`}
    >
      {children}
      {sorted === 'asc' ? (
        <ArrowUp className="ml-1.5 h-3.5 w-3.5" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="ml-1.5 h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
      )}
    </Button>
  );
}

// Pagination component - mobile responsive
function DataTablePagination<TData>({
  table,
  totalCount,
}: {
  table: import('@tanstack/react-table').Table<TData>;
  totalCount?: number;
}) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount();

  // Calculate showing range
  const from = pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalCount ?? table.getFilteredRowModel().rows.length);
  const total = totalCount ?? table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Results info - simplified on mobile */}
      <div className="text-sm text-muted-foreground text-center sm:text-left">
        {total > 0 ? (
          <>
            <span className="hidden sm:inline">
              Showing <span className="font-medium text-foreground">{from}</span> to{' '}
              <span className="font-medium text-foreground">{to}</span> of{' '}
            </span>
            <span className="font-medium text-foreground">{total}</span>
            <span className="sm:hidden"> items</span>
            <span className="hidden sm:inline"> results</span>
          </>
        ) : (
          'No results'
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        {/* Rows per page - hidden on mobile */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[74px] border-border/70">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGINATION.PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page navigation - centered on mobile */}
        <div className="flex items-center justify-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8 border-border/70"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8 border-border/70"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex min-w-[110px] items-center justify-center gap-1 rounded-md border border-border/70 bg-muted/40 px-2 py-1">
            <span className="text-sm font-medium">{pageIndex + 1}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm font-medium">{pageCount || 1}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8 border-border/70"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 sm:h-8 sm:w-8 border-border/70"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            aria-label="Go to last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
