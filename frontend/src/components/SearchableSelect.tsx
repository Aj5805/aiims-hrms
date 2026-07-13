import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type SearchableOption = {
  value: string;
  label: string;
  sublabel?: string;
  /** Extra text included when filtering (e.g. department name). */
  searchText?: string;
};

type DropdownCoords = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type Props = {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  id?: string;
  onQueryChange?: (query: string) => void;
  /** Compact single-line rows (default on). */
  dense?: boolean;
};

function optionMatches(option: SearchableOption, query: string): boolean {
  if (!query) return true;
  const haystack = `${option.label} ${option.sublabel ?? ''} ${option.searchText ?? ''}`.toLowerCase();
  return haystack.includes(query);
}

function measureDropdown(input: HTMLInputElement): DropdownCoords {
  const rect = input.getBoundingClientRect();
  const gap = 4;
  const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
  const spaceAbove = rect.top - gap - 8;
  const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
  const maxHeight = Math.min(Math.max(preferBelow ? spaceBelow : spaceAbove, 160), 320);
  const top = preferBelow ? rect.bottom + gap : rect.top - gap - maxHeight;
  return { top, left: rect.left, width: rect.width, maxHeight };
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search or select…',
  disabled = false,
  loading = false,
  emptyMessage = 'No matches',
  className = '',
  id,
  onQueryChange,
  dense = true,
}: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [coords, setCoords] = useState<DropdownCoords | null>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => optionMatches(o, q)) : options;
  }, [options, query]);

  const updateCoords = () => {
    if (!inputRef.current) return;
    setCoords(measureDropdown(inputRef.current));
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();
    const onReflow = () => updateCoords();
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    return () => {
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [open, filtered.length]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      onQueryChange?.('');
    }
  }, [open, onQueryChange]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      const portal = document.getElementById(listId);
      if (portal?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [listId]);

  const displayValue = open ? query : (selected?.label ?? '');

  const dropdown = open && !disabled && coords
    ? createPortal(
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: coords.width,
            maxHeight: coords.maxHeight,
            zIndex: 9999,
          }}
          className="searchable-select-dropdown overflow-y-auto app-scroll-y rounded-md border border-slate-200 bg-white py-0.5 shadow-lg"
        >
          {filtered.length === 0 && (
            <li className="px-2 py-1.5 text-[11px] text-slate-500">{emptyMessage}</li>
          )}
          {filtered.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`w-full text-left hover:bg-indigo-50 ${
                    dense ? 'px-2 py-1 text-xs leading-snug' : 'px-3 py-2 text-sm'
                  } ${active ? 'bg-indigo-50 font-medium text-indigo-800' : 'text-slate-800'}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {dense ? (
                    <span className="block truncate">
                      <span className="font-medium">{option.label}</span>
                      {option.sublabel ? (
                        <span className="text-slate-500 font-normal"> · {option.sublabel}</span>
                      ) : null}
                    </span>
                  ) : (
                    <>
                      <div>{option.label}</div>
                      {option.sublabel && (
                        <div className="text-[10px] text-slate-500 mt-0.5">{option.sublabel}</div>
                      )}
                    </>
                  )}
                </button>
              </li>
            );
          })}
        </ul>,
        document.body,
      )
    : null;

  return (
    <div ref={rootRef} className={`searchable-select relative ${className}`}>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled || loading}
        placeholder={loading ? 'Loading…' : placeholder}
        value={displayValue}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onQueryChange?.(next);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          if (!disabled && !loading) setOpen(true);
        }}
        className="form-input w-full pr-8"
        autoComplete="off"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
        {loading ? '…' : '▾'}
      </span>
      {dropdown}
    </div>
  );
}
