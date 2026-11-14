import React, { useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Code2, Search } from 'lucide-react';
import type { CatalogPagination, ComicSummary, KomikuFilters } from '../types';
import { ComicDetailModal } from './ComicDetailModal';
import { JsonResponseModal } from './JsonResponseModal';
import { SelectDropdown } from './SelectDropdown';
import { StarRating } from './StarRating';

type LibraryPreset = 'all' | 'Manga' | 'Manhwa' | 'Manhua' | 'anime';

export function PerpustakaanSection() {
  const [preset, setPreset] = useState<LibraryPreset>('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'rating'>('latest');
  const [perPage, setPerPage] = useState(50);
  const [page, setPage] = useState(1);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [filters, setFilters] = useState<KomikuFilters>({
    genres: [],
    types: ['Manga', 'Manhwa', 'Manhua'],
    statuses: ['Semua', 'Ongoing', 'Completed', 'Hiatus'],
  });
  const [items, setItems] = useState<ComicSummary[]>([]);
  const [pagination, setPagination] = useState<CatalogPagination>({
    page: 1,
    limit: 50,
    total_items: 0,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [jsonModalPath, setJsonModalPath] = useState<string | null>(null);
  const [coverStage, setCoverStage] = useState<Record<number, 'proxy' | 'broken'>>({});

  useEffect(() => {
    fetch('/api/public/filters')
      .then((r) => r.json())
      .then((json: { status: boolean; data?: KomikuFilters }) => {
        if (json.status && json.data) {
          setFilters(json.data);
        }
      })
      .catch(() => {});
  }, []);

  const effectiveType = preset === 'anime' ? 'all' : preset;
  const effectiveGenre = preset === 'anime' && genreFilter === 'all' ? 'Adaptation' : genreFilter;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      category: 'perpustakaan',
      type: effectiveType,
      genre: effectiveGenre,
      status: statusFilter,
      sort: sortBy,
      q: searchQuery,
      page: String(page),
      limit: String(perPage),
    });

    fetch(`/api/public/catalog?${params.toString()}`)
      .then((r) => r.json())
      .then((json: { status: boolean; data?: { items: ComicSummary[]; pagination: CatalogPagination } }) => {
        if (!cancelled && json.status && json.data) {
          setItems(json.data.items);
          setPagination(json.data.pagination);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [effectiveType, effectiveGenre, statusFilter, sortBy, searchQuery, page, perPage]);

  const buildV1LibraryPath = (): string => {
    const base = preset === 'anime' ? '/api/v1/anime/perpustakaan' : '/api/v1/komik/perpustakaan';
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(perPage));
    if (effectiveType !== 'all') params.set('type', effectiveType);
    if (effectiveGenre !== 'all') params.set('genre', effectiveGenre);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    params.set('sort', sortBy);
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    return `${base}?${params.toString()}`;
  };

  const handlePresetChange = (next: LibraryPreset) => {
    setPreset(next);
    setPage(1);
  };

  const getPageWindow = (): number[] => {
    const total = Math.max(1, pagination.total_pages);
    const current = Math.min(page, total);
    const start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    const adjustedStart = Math.max(1, end - 4);
    const pages: number[] = [];
    for (let i = adjustedStart; i <= end; i += 1) {
      pages.push(i);
    }
    return pages;
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number.parseInt(jumpPageInput, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= pagination.total_pages) {
      setPage(num);
      setJumpPageInput('');
    }
  };

  const handleCoverError = (comic: ComicSummary) => {
    setCoverStage((prev) => {
      const current = prev[comic.id];
      if (!current && comic.proxy_cover_url) {
        return { ...prev, [comic.id]: 'proxy' };
      }
      return { ...prev, [comic.id]: 'broken' };
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-medium tracking-wide text-rose-700">
            Arsip Lengkap Komiku.org · Pagination Real-Time
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Perpustakaan Anime & Komik Komiku
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Telusuri seluruh koleksi {pagination.total_items.toLocaleString('id-ID')} judul dari Komiku.org lengkap dengan filter tipe, 50+ genre, adaptasi anime, urutan rilis, serta tombol ambil respon JSON langsung tanpa cURL.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setJsonModalPath(buildV1LibraryPath())}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap sm:w-auto sm:shrink-0"
        >
          <Code2 className="h-4 w-4 text-rose-400" />
          Ambil Respon JSON Halaman Ini
        </button>
      </div>

      {/* Filter Bar */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-lg bg-slate-100 p-1">
            {(
              [
                { id: 'all', label: 'Semua Koleksi' },
                { id: 'Manga', label: 'Manga' },
                { id: 'Manhwa', label: 'Manhwa' },
                { id: 'Manhua', label: 'Manhua' },
                { id: 'anime', label: 'Adaptasi Anime' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handlePresetChange(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  preset === tab.id ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Filter judul di perpustakaan..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="lib-genre" className="block text-xs font-medium text-slate-600">
              Genre ({filters.genres.length})
            </label>
            <SelectDropdown
              id="lib-genre"
              ariaLabel="Filter genre perpustakaan"
              value={genreFilter}
              onChange={(next) => {
                setGenreFilter(next);
                setPage(1);
              }}
              searchable
              searchPlaceholder="Cari genre..."
              className="mt-1 w-full"
              options={[
                { value: 'all', label: 'Semua Genre' },
                ...filters.genres.map((g) => ({ value: g, label: g })),
              ]}
            />
          </div>

          <div>
            <label htmlFor="lib-status" className="block text-xs font-medium text-slate-600">
              Status Rilis
            </label>
            <SelectDropdown
              id="lib-status"
              ariaLabel="Filter status rilis"
              value={statusFilter}
              onChange={(next) => {
                setStatusFilter(next);
                setPage(1);
              }}
              className="mt-1 w-full"
              options={[
                { value: 'all', label: 'Semua Status' },
                { value: 'Ongoing', label: 'Ongoing' },
                { value: 'Completed', label: 'Completed' },
                { value: 'Hiatus', label: 'Hiatus' },
              ]}
            />
          </div>

          <div>
            <label htmlFor="lib-sort" className="block text-xs font-medium text-slate-600">
              Urutkan
            </label>
            <SelectDropdown
              id="lib-sort"
              ariaLabel="Urutkan perpustakaan"
              value={sortBy}
              onChange={(next) => {
                setSortBy(next as 'latest' | 'popular' | 'rating');
                setPage(1);
              }}
              className="mt-1 w-full"
              options={[
                { value: 'latest', label: 'Update Terbaru' },
                { value: 'popular', label: 'Terpopuler (Views)' },
                { value: 'rating', label: 'Rating Tertinggi' },
              ]}
            />
          </div>

          <div>
            <label htmlFor="lib-limit" className="block text-xs font-medium text-slate-600">
              Item per Halaman
            </label>
            <SelectDropdown
              id="lib-limit"
              ariaLabel="Jumlah item per halaman"
              value={String(perPage)}
              onChange={(next) => {
                setPerPage(Number(next));
                setPage(1);
              }}
              menuAlign="right"
              className="mt-1 w-full"
              options={[
                { value: '10', label: '10 judul' },
                { value: '24', label: '24 judul' },
                { value: '50', label: '50 judul (Penuh)' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Pagination Top Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
        <p className="tabular-nums">
          Menampilkan halaman <span className="font-semibold text-slate-900">{pagination.page}</span> dari{' '}
          <span className="font-semibold text-slate-900">{pagination.total_pages.toLocaleString('id-ID')}</span> · Total{' '}
          <span className="font-semibold text-slate-900">{pagination.total_items.toLocaleString('id-ID')}</span> judul
        </p>
        <p className="font-mono text-slate-500 truncate max-w-full">{buildV1LibraryPath()}</p>
      </div>

      {/* Library Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2.5">
              <div className="aspect-[3/4] rounded-lg bg-slate-200/70 animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-slate-200/70 animate-pulse" />
              <div className="h-3 w-3/5 rounded bg-slate-200/70 animate-pulse" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center sm:p-10">
          <p className="text-sm font-medium text-slate-900">Tidak ada judul yang sesuai filter perpustakaan.</p>
          <button
            type="button"
            onClick={() => {
              setPreset('all');
              setGenreFilter('all');
              setStatusFilter('all');
              setSearchQuery('');
              setPage(1);
            }}
            className="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-5 md:grid-cols-4 lg:grid-cols-6">
          {items.map((comic) => {
            const stage = coverStage[comic.id];
            const imgSrc = stage === 'proxy' ? comic.proxy_cover_url : comic.cover_url;
            return (
              <button
                key={`${comic.id}-${comic.slug}`}
                type="button"
                onClick={() => setSelectedSlug(comic.slug)}
                className="group flex flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-700"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {stage === 'broken' || !imgSrc ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-slate-900 p-3 text-center text-white">
                      <BookOpen className="mb-2 h-6 w-6 text-rose-400" />
                      <span className="text-xs font-semibold leading-snug line-clamp-3">{comic.title}</span>
                    </div>
                  ) : (
                    <img
                      src={imgSrc}
                      alt={`Sampul ${comic.title}`}
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={() => handleCoverError(comic)}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2.5 pt-8 sm:p-3">
                    <p className="font-mono text-[11px] font-medium text-white tabular-nums truncate">
                      {comic.latest_chapter}
                    </p>
                  </div>
                </div>

                <div className="mt-2 space-y-1">
                  <h3 className="font-display text-sm font-semibold leading-snug text-slate-900 line-clamp-2 group-hover:text-rose-700">
                    {comic.title}
                  </h3>
                  <div className="flex items-center">
                    <StarRating rating={comic.rating} compact />
                  </div>
                  <p className="text-xs text-slate-500 truncate tabular-nums">
                    <span>{comic.type}</span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span>{comic.status}</span>
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Full Pagination Bar */}
      <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:px-5">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:px-3"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>

          {getPageWindow().map((pNum) => (
            <button
              key={pNum}
              type="button"
              disabled={loading}
              onClick={() => setPage(pNum)}
              className={`min-w-[34px] rounded-lg px-2.5 py-1.5 font-mono text-xs font-medium tabular-nums transition-colors ${
                pNum === page
                  ? 'bg-rose-700 text-white'
                  : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {pNum}
            </button>
          ))}

          <button
            type="button"
            disabled={page >= pagination.total_pages || loading}
            onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 sm:px-3"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleJumpSubmit} className="flex items-center gap-2 text-xs">
          <label htmlFor="jump-page" className="text-slate-600">
            Lompat ke hal:
          </label>
          <input
            id="jump-page"
            type="number"
            min={1}
            max={pagination.total_pages}
            value={jumpPageInput}
            onChange={(e) => setJumpPageInput(e.target.value)}
            placeholder={String(page)}
            className="w-20 rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs text-slate-900 tabular-nums focus:border-rose-700 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-800 hover:bg-slate-100"
          >
            Buka
          </button>
        </form>
      </div>

      {selectedSlug && <ComicDetailModal slug={selectedSlug} onClose={() => setSelectedSlug(null)} />}
      {jsonModalPath && (
        <JsonResponseModal
          apiPath={jsonModalPath}
          title="Respon JSON Perpustakaan Komiku"
          onClose={() => setJsonModalPath(null)}
        />
      )}
    </div>
  );
}
