'use client';

import { Search, Filter, RefreshCw, Calendar, LucideIcon } from "lucide-react";
import { Dispatch, SetStateAction } from "react";

type ViewMode = 'list' | 'calendar';

interface PageHeaderProps {
  title: string;
  type: string;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  filter?: string;
  setFilter?: Dispatch<SetStateAction<string>>;
  dataLength: number;
  showFilters: boolean;
  setShowFilters: Dispatch<SetStateAction<boolean>>;
  icon: LucideIcon;
  refreshData: () => void;
  onCalendarClick?: (mode: ViewMode) => void;
  viewMode?: ViewMode;
  onViewChange?: (mode: ViewMode) => void;
  isMobile?: boolean;
}

export default function PageHeader({
  title,
  type,
  search,
  setSearch,
  dataLength,
  showFilters,
  setShowFilters,
  icon: Icon,
  refreshData,
  onCalendarClick,
  viewMode = 'list',
  onViewChange,
  isMobile = false,
}: PageHeaderProps) {
  const getPlaceholder = (): string => {
    if (type.toLowerCase() === 'patient') {
      return 'Search by name, email, phone, or patient ID...';
    }
    return `Search ${type.toLowerCase()}...`;
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      { !isMobile && <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-100 rounded-xl">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          <p className="text-gray-500 text-sm">
            {dataLength} {dataLength === 1 ? `${type.toLowerCase()}` : `${type.toLowerCase()}s`} found
          </p>
        </div>
      </div> }
      
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder={getPlaceholder()}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
          />
        </div>
        
        {(onViewChange || onCalendarClick) && (
          <div className="view-switch-container flex items-center gap-0 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onViewChange ? onViewChange('list') : onCalendarClick?.('list')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${
                viewMode === 'list' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="text-sm font-medium">List</span>
            </button>
            <button
              onClick={() => onViewChange ? onViewChange('calendar') : onCalendarClick?.('calendar')}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${
                viewMode === 'calendar' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">Calendar</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`p-2 border rounded-lg transition-colors ${
            showFilters ? 'bg-blue-100 border-blue-300 text-blue-600' : 'border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Filter size={20} />
        </button>

        <button
          onClick={() => refreshData()}
          className={`p-2 border rounded-lg transition-colors ${
            showFilters ? 'bg-blue-100 border-blue-300 text-blue-600' : 'border-gray-300 hover:bg-gray-50'
          }`}
        >
          <RefreshCw size={20} />
        </button>
      </div>
    </div>
  );
}
