"use client";

import { CalendarDays, ChevronUp, ChevronDown } from "lucide-react";

type DateFilterOption = {
  id: string;
  label: string;
  color: string;      // e.g. "bg-blue-600"
  textColor: string;  // e.g. "text-blue-600"
};

interface CompactDateFilterProps {
  currentFilter: string;
  showDateFilters: boolean;
  setShowDateFilters: (show: boolean) => void;
  dateFilter: string;
  setDateFilter: (filter: string) => void;
  setCurrentPage: (page: number) => void;
  dateFilterOptions: DateFilterOption[];
}

export default function CompactDateFilter({
  currentFilter,
  showDateFilters,
  setShowDateFilters,
  dateFilter,
  setDateFilter,
  setCurrentPage,
  dateFilterOptions,
}: CompactDateFilterProps) {
  return (
    <div className="bg-white p-2 rounded-xl shadow-md border border-gray-100 mb-4 mt-4">
      <div className="flex items-center justify-between">
        {/* Current filter display */}
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Date Range:</span>
          <span className="text-sm font-semibold text-blue-600">
            {currentFilter}
          </span>
        </div>

        {/* Toggle button */}
        <button
          onClick={() => setShowDateFilters(!showDateFilters)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          <span>Change</span>
          {showDateFilters ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Collapsible date options */}
      {showDateFilters && (
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap gap-2">
            {dateFilterOptions.map((range) => (
              <button
                key={range.id}
                onClick={() => {
                  setDateFilter(range.id);
                  setCurrentPage(1);
                  setShowDateFilters(false);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  dateFilter === range.id
                    ? `${range.color} text-white shadow-md`
                    : `bg-white text-gray-700 border border-gray-200 hover:${range.textColor} hover:border-current`
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
