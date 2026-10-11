import React, { useState, useEffect } from 'react';
import type { NodeCategory } from '../../types';
import type { FilterState, ReachOption } from '../../services/graphFilterLogic';
import { CATEGORY_THEMES } from '../../services/graphTheme';
import { Search, X } from 'lucide-react';

export interface GraphFiltersProps {
  filters: FilterState;
  onChange: (newFilters: FilterState) => void;
  visibleCount: number;
  totalCount: number;
}

const CATEGORIES: NodeCategory[] = [
  'emocion',
  'sintoma_fisico',
  'astrologia',
  'patron',
  'idea',
  'relacion',
  'otro',
];

export const GraphFilters: React.FC<GraphFiltersProps> = ({
  filters,
  onChange,
  visibleCount,
  totalCount,
}) => {
  const [searchInput, setSearchInput] = useState(filters.searchQuery);

  // Debounce search input (150ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchInput !== filters.searchQuery) {
        onChange({ ...filters, searchQuery: searchInput });
      }
    }, 150);
    return () => clearTimeout(handler);
  }, [searchInput, filters, onChange]);

  const toggleCategory = (cat: NodeCategory) => {
    const nextCategories = new Set(filters.selectedCategories);
    if (nextCategories.has(cat)) {
      nextCategories.delete(cat);
    } else {
      nextCategories.add(cat);
    }
    onChange({ ...filters, selectedCategories: nextCategories });
  };

  const setReach = (reach: ReachOption) => {
    onChange({ ...filters, reach });
  };

  return (
    <div className="bg-white/95 backdrop-blur-md border-b border-amber-200/50 px-3 py-2 space-y-2 text-xs shadow-2xs">
      {/* Top row: Search input & counter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar nodos..."
            className="w-full pl-8 pr-7 py-1 bg-stone-100 hover:bg-stone-50 focus:bg-white border border-stone-200 focus:border-amber-400 rounded-full text-stone-800 placeholder-stone-400 focus:outline-none transition-all"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('');
                onChange({ ...filters, searchQuery: '' });
              }}
              className="absolute right-2 text-stone-400 hover:text-stone-600 p-0.5 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <span className="text-[11px] font-semibold text-stone-500 whitespace-nowrap bg-stone-100 px-2 py-1 rounded-full">
          {visibleCount} de {totalCount}
        </span>
      </div>

      {/* Middle row: Reach selector & Category Chips */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-0.5">
        {/* Reach Selector */}
        <div className="flex items-center bg-stone-100 p-0.5 rounded-lg shrink-0">
          <button
            onClick={() => setReach('importantes')}
            className={`px-2 py-0.5 rounded-md font-medium text-[10px] transition-all ${
              filters.reach === 'importantes'
                ? 'bg-white text-amber-900 shadow-2xs font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Importantes
          </button>
          <button
            onClick={() => setReach('recientes')}
            className={`px-2 py-0.5 rounded-md font-medium text-[10px] transition-all ${
              filters.reach === 'recientes'
                ? 'bg-white text-amber-900 shadow-2xs font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Recientes
          </button>
          <button
            onClick={() => setReach('todos')}
            className={`px-2 py-0.5 rounded-md font-medium text-[10px] transition-all ${
              filters.reach === 'todos'
                ? 'bg-white text-amber-900 shadow-2xs font-bold'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Todos
          </button>
        </div>

        {/* Category Chips */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => {
            const theme = CATEGORY_THEMES[cat];
            const isSelected = filters.selectedCategories.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                style={{
                  backgroundColor: isSelected ? theme.bg : '#f5f5f4',
                  borderColor: isSelected ? theme.border : '#e7e5e4',
                  color: isSelected ? theme.text : '#78716c',
                }}
                className={`px-2 py-0.5 rounded-full border text-[10px] font-medium transition-all whitespace-nowrap shrink-0 ${
                  isSelected ? 'shadow-2xs font-bold' : 'opacity-70 hover:opacity-100'
                }`}
              >
                {theme.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
