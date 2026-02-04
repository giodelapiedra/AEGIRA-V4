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
} from 'lucide-react';

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
              className="pl-9 h-9"
            />
          </div>
        </div>
      )}

      {/* Table with horizontal scroll on mobile */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading skeleton rows
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="hover:bg-transparent">
                    {columns.map((_, j) => (
                      <TableCell key={j}>
                        <div className="h-4 w-full max-w-[200px] animate-pulse rounded bg-muted" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length}
                    className="h-32 text-center text-muted-foreground"
                  >
                    {emptyMessage}
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
      className="-ml-3 h-8 font-medium text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground whitespace-nowrap"
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
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Page navigation - centered on mobile */}
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 px-2 min-w-[100px] justify-center">
            <span className="text-sm font-medium">{pageIndex + 1}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm font-medium">{pageCount || 1}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
