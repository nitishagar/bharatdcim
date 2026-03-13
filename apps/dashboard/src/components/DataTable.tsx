import { useState, useEffect, type ReactNode } from 'react';
import { exportToCSV } from '../lib/csvExport';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';

function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  enableSearch?: boolean;
  pageSize?: number;
  exportFilename?: string;
  // Server-side (manual) pagination props
  manualPagination?: boolean;
  pageIndex?: number;
  totalRows?: number;
  onPageChange?: (index: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSearch?: (search: string) => void;
}

export type { ColumnDef };

export function DataTable<T>({
  columns,
  data,
  onRowClick,
  searchPlaceholder = 'Search...',
  enableSearch = true,
  pageSize = 25,
  exportFilename,
  manualPagination = false,
  pageIndex = 0,
  totalRows = 0,
  onPageChange,
  onPageSizeChange,
  onSearch,
}: DataTableProps<T>) {
  const [localFilter, setLocalFilter] = useState('');
  const debouncedFilter = useDebounce(localFilter);
  const [sorting, setSorting] = useState<SortingState>([]);

  // In manual mode, propagate debounced search to parent
  useEffect(() => {
    if (manualPagination) {
      onSearch?.(debouncedFilter);
    }
  }, [debouncedFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const state = manualPagination
    ? { globalFilter: undefined as string | undefined, sorting, pagination: { pageIndex, pageSize } }
    : { globalFilter: debouncedFilter, sorting };

  const table = useReactTable({
    data,
    columns,
    state,
    manualPagination,
    manualFiltering: manualPagination,
    pageCount: manualPagination ? Math.ceil(totalRows / pageSize) : undefined,
    onGlobalFilterChange: manualPagination ? undefined : setLocalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: manualPagination ? undefined : { pagination: { pageSize } },
  });

  const rows = table.getRowModel().rows;
  const serverPageCount = manualPagination ? Math.ceil(totalRows / pageSize) : 0;

  function handleExportCSV() {
    const headers = table
      .getAllColumns()
      .filter((col) => col.getIsVisible())
      .map((col) => {
        const h = col.columnDef.header;
        return typeof h === 'string' ? h : col.id;
      });

    const csvRows = table.getFilteredRowModel().rows.map((row) =>
      row.getAllCells().map((cell) => {
        const val = cell.getValue();
        return val == null ? '' : String(val);
      }),
    );

    exportToCSV(exportFilename!, headers, csvRows);
  }

  return (
    <div className="space-y-3">
      {(enableSearch || exportFilename) && (
        <div className="flex items-center gap-2">
          {enableSearch && (
            <input
              value={localFilter}
              onChange={(e) => {
                setLocalFilter(e.target.value);
                if (manualPagination) onPageChange?.(0); // reset to page 0 on new search
              }}
              placeholder={searchPlaceholder}
              className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400 dark:focus:border-navy-light dark:focus:ring-navy-light"
            />
          )}
          {exportFilename && (
            <button
              onClick={handleExportCSV}
              className="ml-auto shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Export CSV
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 dark:bg-gray-700/50 dark:border-gray-600">
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-gray-600 select-none dark:text-gray-300"
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && <SortArrow direction="asc" />}
                      {header.column.getIsSorted() === 'desc' && <SortArrow direction="desc" />}
                    </span>
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  {localFilter ? 'No results match your search.' : 'No data available.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-gray-100 dark:border-gray-700 ${
                    onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''
                  }`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-gray-800 dark:text-gray-200">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Client-side pagination footer */}
      {!manualPagination && table.getPageCount() > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length,
            )}{' '}
            of {table.getFilteredRowModel().rows.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Prev
            </button>
            <span>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Server-side pagination footer */}
      {manualPagination && serverPageCount > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <span>
              {totalRows === 0
                ? 'No results'
                : `Showing ${pageIndex * pageSize + 1}–${Math.min((pageIndex + 1) * pageSize, totalRows)} of ${totalRows}`}
            </span>
            {onPageSizeChange && (
              <select
                value={pageSize}
                onChange={(e) => {
                  onPageSizeChange(parseInt(e.target.value));
                  onPageChange?.(0);
                }}
                className="rounded border border-gray-300 px-2 py-1 text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300"
              >
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s} per page
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(pageIndex - 1)}
              disabled={pageIndex === 0}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Prev
            </button>
            <span>
              Page {pageIndex + 1} of {serverPageCount}
            </span>
            <button
              onClick={() => onPageChange?.(pageIndex + 1)}
              disabled={pageIndex >= serverPageCount - 1}
              className="rounded border px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SortArrow({ direction }: { direction: 'asc' | 'desc' }): ReactNode {
  return (
    <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 16 16" fill="currentColor">
      {direction === 'asc' ? (
        <path d="M8 4l4 5H4l4-5z" />
      ) : (
        <path d="M8 12l-4-5h8l-4 5z" />
      )}
    </svg>
  );
}
