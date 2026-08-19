'use client';

import { X } from "lucide-react";

type StatusOption = {
  value: string;
  label: string;
};

type StatusFilterType = 'all' | 'active' | 'inactive' | 'pending' | 'completed' | string;

export type DateRange = { from: string; to: string };

interface FiltersPanelProps {
  title: string;
  statusFilter: StatusFilterType;
  setStatusFilter: (filter: StatusFilterType) => void;
  onClose: () => void;
  onClear: () => void;
  statusOptions?: StatusOption[];
  dateRange?: DateRange;
  setDateRange?: (range: DateRange) => void;
  dateRangeLabel?: string;
  sortBy?: string;
  setSortBy?: (value: string) => void;
  sortOrder?: 'asc' | 'desc';
  setSortOrder?: (value: 'asc' | 'desc') => void;
  sortOptions?: StatusOption[];
}

const defaultStatusOptions: StatusOption[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' }
];

export default function FiltersPanel({
  title,
  statusFilter,
  setStatusFilter,
  onClose,
  onClear,
  statusOptions = defaultStatusOptions,
  dateRange,
  setDateRange,
  dateRangeLabel = 'Date Range',
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  sortOptions,
}: FiltersPanelProps) {
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Filter {title}</h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          type="button"
          aria-label="Close filters panel"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilterType)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {dateRange && setDateRange && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {dateRangeLabel}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.from}
                max={dateRange.to || undefined}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label={`${dateRangeLabel} from`}
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={dateRange.to}
                min={dateRange.from || undefined}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label={`${dateRangeLabel} to`}
              />
            </div>
          </div>
        )}

        {sortBy !== undefined && setSortBy && sortOptions && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort by
            </label>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {sortOrder !== undefined && setSortOrder && (
                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm whitespace-nowrap"
                  aria-label={`Sort order: ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
                >
                  {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onClear}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          type="button"
        >
          Clear All
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          type="button"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
}
