'use client';

import { User } from "lucide-react";

interface NoDataFoundProps {
  type?: string;
  searchQuery?: string;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

export default function NoDataFound({ 
  type = 'doctors', 
  searchQuery, 
  hasFilters = false, 
  onClearFilters 
}: NoDataFoundProps) {
  const entityType = type || 'doctors';

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-surface-canvas rounded-full flex items-center justify-center mx-auto mb-4">
        <User size={24} className="text-ink-500" />
      </div>

      {searchQuery ? (
        <>
          <h3 className="font-display tracking-tight text-lg font-semibold text-ink-900 mb-2">No {entityType} found</h3>
          <p className="text-ink-700 mb-4">
            No results found for "<span className="font-medium">{searchQuery}</span>"
          </p>
        </>
      ) : hasFilters ? (
        <>
          <h3 className="font-display tracking-tight text-lg font-semibold text-ink-900 mb-2">No matching {entityType}</h3>
          <p className="text-ink-700 mb-4">Try adjusting your filters</p>
        </>
      ) : (
        <>
          <h3 className="font-display tracking-tight text-lg font-semibold text-ink-900 mb-2">No {entityType} yet</h3>
          <p className="text-ink-700 mb-4">Get started by adding your first {entityType.slice(0, -1)}</p>
        </>
      )}

      {hasFilters && onClearFilters && (
        <button
          onClick={onClearFilters}
          className="bg-brand-violet text-white px-4 py-2 rounded-lg hover:bg-brand-violet-hover transition-colors"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
