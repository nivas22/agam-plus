"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  total: number;
  limit: number;
  transparent?: boolean;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  hasNextPage,
  hasPreviousPage,
  total,
  limit,
  transparent = false,
}: PaginationProps) {
  const startItem = (currentPage - 1) * limit + 1;
  const endItem = Math.min(currentPage * limit, total);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div
      className={`flex items-center justify-between px-6 py-4 sm:px-8 ${
        transparent ? '' : 'bg-gradient-to-r from-surface-paper to-surface-canvas border-t border-border rounded-b-xl shadow-sm'
      }`}
    >

      {/* Mobile View */}
      <div className="flex justify-between items-center flex-1 gap-3 sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPreviousPage}
          className="relative inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-ink-700 bg-surface-paper border-2 border-border rounded-lg hover:bg-brand-violet-soft hover:border-brand-violet hover:text-brand-violet disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-paper disabled:hover:border-border disabled:hover:text-ink-700 transition-all duration-200 shadow-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>
        <div className="flex flex-col items-center">
          <span className="text-xs font-medium text-ink-500">Page</span>
          <span className="text-lg font-bold text-brand-violet">{currentPage}</span>
          <span className="text-xs text-ink-500">of {totalPages}</span>
        </div>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNextPage}
          className="relative inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-ink-700 bg-surface-paper border-2 border-border rounded-lg hover:bg-brand-violet-soft hover:border-brand-violet hover:text-brand-violet disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-paper disabled:hover:border-border disabled:hover:text-ink-700 transition-all duration-200 shadow-sm"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Desktop View */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-4 py-2 bg-brand-violet-soft rounded-lg border border-brand-violet/20">
            <span className="text-sm text-ink-700">Showing</span>
            <span className="font-bold text-brand-violet">{startItem}</span>
            <span className="text-sm text-ink-700">to</span>
            <span className="font-bold text-brand-violet">{endItem}</span>
            <span className="text-sm text-ink-700">of</span>
            <span className="font-bold text-brand-violet">{total}</span>
            <span className="text-sm text-ink-700">results</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* First Page Button */}
          <button
            onClick={() => onPageChange(1)}
            disabled={!hasPreviousPage}
            className="relative inline-flex items-center justify-center w-10 h-10 text-ink-700 bg-surface-paper border-2 border-border rounded-lg hover:bg-brand-violet-soft hover:border-brand-violet hover:text-brand-violet disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-surface-paper disabled:hover:border-border disabled:hover:text-ink-700 transition-all duration-200 shadow-sm hover:shadow-md"
            title="First page"
          >
            <ChevronsLeft className="w-5 h-5" />
          </button>

          {/* Previous Button */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={!hasPreviousPage}
            className="relative inline-flex items-center justify-center w-10 h-10 text-ink-700 bg-surface-paper border-2 border-border rounded-lg hover:bg-brand-violet-soft hover:border-brand-violet hover:text-brand-violet disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-surface-paper disabled:hover:border-border disabled:hover:text-ink-700 transition-all duration-200 shadow-sm hover:shadow-md"
            title="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Page Numbers */}
          <nav className="inline-flex gap-1.5" aria-label="Pagination">
            {getPageNumbers().map((page, index) => (
              <button
                key={index}
                onClick={() => typeof page === "number" && onPageChange(page)}
                disabled={page === "..."}
                className={`relative inline-flex items-center justify-center min-w-[2.5rem] h-10 px-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                  page === currentPage
                    ? "bg-brand-violet text-white border-2 border-brand-violet shadow-lg shadow-brand-violet/30 scale-105 hover:shadow-xl"
                    : page === "..."
                    ? "bg-transparent text-ink-500 cursor-default border-2 border-transparent"
                    : "bg-surface-paper text-ink-700 border-2 border-border hover:bg-brand-violet-soft hover:border-brand-violet hover:text-brand-violet hover:scale-105 shadow-sm hover:shadow-md"
                }`}
              >
                {page}
              </button>
            ))}
          </nav>

          {/* Next Button */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={!hasNextPage}
            className="relative inline-flex items-center justify-center w-10 h-10 text-ink-700 bg-surface-paper border-2 border-border rounded-lg hover:bg-brand-violet-soft hover:border-brand-violet hover:text-brand-violet disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-surface-paper disabled:hover:border-border disabled:hover:text-ink-700 transition-all duration-200 shadow-sm hover:shadow-md"
            title="Next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Last Page Button */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={!hasNextPage}
            className="relative inline-flex items-center justify-center w-10 h-10 text-ink-700 bg-surface-paper border-2 border-border rounded-lg hover:bg-brand-violet-soft hover:border-brand-violet hover:text-brand-violet disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-surface-paper disabled:hover:border-border disabled:hover:text-ink-700 transition-all duration-200 shadow-sm hover:shadow-md"
            title="Last page"
          >
            <ChevronsRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
