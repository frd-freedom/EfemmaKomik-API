import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  menuAlign?: 'left' | 'right';
  portal?: boolean;
  buttonClassName?: string;
}

export function SelectDropdown({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  searchable = false,
  searchPlaceholder = 'Cari...',
  disabled = false,
  className = '',
  menuAlign = 'left',
  portal = false,
  buttonClassName = '',
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [portalPos, setPortalPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const listboxId = `${id || generatedId}-listbox`;

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) || options[0],
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }

    const updatePortalPosition = () => {
      if (!portal || !buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = Math.max(rect.width, 190);
      const left =
        menuAlign === 'right'
          ? Math.max(8, rect.right - menuWidth)
          : Math.min(rect.left, window.innerWidth - menuWidth - 8);
      setPortalPos({
        top: rect.bottom + 6,
        left,
        width: menuWidth,
      });
    };

    updatePortalPosition();

    if (searchable) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    if (portal) {
      window.addEventListener('resize', updatePortalPosition);
      window.addEventListener('scroll', updatePortalPosition, true);
    }
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      if (portal) {
        window.removeEventListener('resize', updatePortalPosition);
        window.removeEventListener('scroll', updatePortalPosition, true);
      }
    };
  }, [open, searchable, portal, menuAlign]);

  const menuNode = open ? (
    <div
      ref={menuRef}
      id={listboxId}
      role="listbox"
      aria-label={ariaLabel || 'Pilihan'}
      style={
        portal && portalPos
          ? {
              position: 'fixed',
              top: portalPos.top,
              left: portalPos.left,
              width: portalPos.width,
              zIndex: 70,
            }
          : undefined
      }
      className={`${
        portal ? '' : `absolute z-50 mt-1.5 w-full min-w-[210px] ${menuAlign === 'right' ? 'right-0' : 'left-0'}`
      } overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg ring-1 ring-slate-950/5`}
    >
      {searchable && (
        <div className="border-b border-slate-100 bg-slate-50/70 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none"
            />
          </div>
        </div>
      )}

      <div className="max-h-60 overflow-y-auto overscroll-contain p-1">
        {filteredOptions.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-500">Tidak ada pilihan cocok.</p>
        ) : (
          filteredOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? 'bg-rose-50 font-semibold text-rose-800'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-rose-700" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-xs text-slate-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? 'border-rose-700 ring-2 ring-rose-700/15' : 'border-slate-200 hover:border-slate-300'
        } ${buttonClassName}`}
      >
        <span className="truncate font-medium">{selectedOption?.label || value}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-150 ${
            open ? 'rotate-180 text-rose-700' : ''
          }`}
        />
      </button>

      {portal && typeof document !== 'undefined' ? (menuNode ? createPortal(menuNode, document.body) : null) : menuNode}
    </div>
  );
}
