import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems?: number;
  itemCount?: number;
  itemLabel?: string;
  loading?: boolean;
  onPageChange: (nextPage: number) => void;
}

type PageItem = number | 'ellipsis-left' | 'ellipsis-right';

function buildPageItems(current: number, total: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }

  const items: PageItem[] = [1];
  const windowStart = Math.max(2, current - 1);
  const windowEnd = Math.min(total - 1, current + 1);

  if (windowStart > 2) {
    items.push('ellipsis-left');
  }

  for (let p = windowStart; p <= windowEnd; p += 1) {
    items.push(p);
  }

  if (windowEnd < total - 1) {
    items.push('ellipsis-right');
  }

  items.push(total);
  return items;
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  itemCount,
  itemLabel = 'item',
  loading = false,
  onPageChange,
}: PaginationProps) {
  const [jumpInput, setJumpInput] = useState('');
  const safeTotal = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotal);
  const items = buildPageItems(safePage, safeTotal);

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number.parseInt(jumpInput, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= safeTotal) {
      onPageChange(num);
      setJumpInput('');
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
        <span>
          Halaman <span className="font-semibold text-slate-950 dark:text-white">{safePage.toLocaleString('id-ID')}</span> dari{' '}
          <span className="font-semibold text-slate-950 dark:text-white">{safeTotal.toLocaleString('id-ID')}</span>
        </span>
        {typeof itemCount === 'number' && (
          <>
            <span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
            <span>
              Menampilkan <span className="font-semibold text-slate-900 dark:text-slate-200">{itemCount}</span> {itemLabel}
            </span>
          </>
        )}
        {typeof totalItems === 'number' && totalItems > 0 && (
          <>
            <span className="mx-1.5 text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
            <span>
              Total <span className="font-semibold text-slate-900 dark:text-slate-200">{totalItems.toLocaleString('id-ID')}</span>
            </span>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <nav aria-label="Navigasi halaman" className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1 || loading}
            onClick={() => onPageChange(1)}
            aria-label="Halaman pertama"
            title="Halaman pertama"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={safePage <= 1 || loading}
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            aria-label="Halaman sebelumnya"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>

          <div className="flex items-center gap-1">
            {items.map((item) => {
              if (item === 'ellipsis-left' || item === 'ellipsis-right') {
                return (
                  <span
                    key={item}
                    aria-hidden="true"
                    className="inline-flex h-8 w-7 items-center justify-center font-mono text-xs text-slate-400 dark:text-slate-500 select-none"
                  >
                    ...
                  </span>
                );
              }
              const active = item === safePage;
              return (
                <button
                  key={item}
                  type="button"
                  disabled={loading}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onPageChange(item)}
                  className={`inline-flex h-8 min-w-[32px] items-center justify-center rounded-lg px-2 font-mono text-xs font-medium tabular-nums transition-colors ${
                    active
                      ? 'bg-slate-950 dark:bg-rose-600 text-white font-semibold'
                      : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={safePage >= safeTotal || loading}
            onClick={() => onPageChange(Math.min(safeTotal, safePage + 1))}
            aria-label="Halaman berikutnya"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            disabled={safePage >= safeTotal || loading}
            onClick={() => onPageChange(safeTotal)}
            aria-label="Halaman terakhir"
            title="Halaman terakhir"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </nav>

        <form onSubmit={handleJump} className="flex items-center gap-1.5 text-xs">
          <label htmlFor="pagination-jump" className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Hal:
          </label>
          <input
            id="pagination-jump"
            type="number"
            min={1}
            max={safeTotal}
            value={jumpInput}
            onChange={(e) => setJumpInput(e.target.value)}
            placeholder={String(safePage)}
            className="h-8 w-16 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 font-mono text-xs text-slate-900 dark:text-slate-100 tabular-nums focus:border-slate-900 dark:focus:border-rose-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 whitespace-nowrap"
          >
            Buka
          </button>
        </form>
      </div>
    </div>
  );
}
