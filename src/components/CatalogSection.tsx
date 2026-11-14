import React, { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Code2, Search } from 'lucide-react';
import type { CacheStats, ComicSummary, ComicType, KomikuFilters } from '../types';
import { ComicDetailModal } from './ComicDetailModal';
import { JsonResponseModal } from './JsonResponseModal';
import { SelectDropdown } from './SelectDropdown';
import { StarRating } from './StarRating';
import { useAuth } from '../contexts/AuthContext';
import type { ActiveTab } from './Navbar';

interface CatalogSectionProps {
  onNavigate: (tab: ActiveTab) => void;
}

const SAMPLE_HERO_JSON = `{
  "status": true,
  "code": 200,
  "meta": {
    "provider": "NusaKomik API v1 (Komiku.org)",
    "language": "id",
    "cache": "HIT",
    "response_time_ms": 0.42
  },
  "data": {
    "items": [
      {
        "rank": 2,
        "slug": "black-clover-indonesia",
        "title": "Black Clover",
        "type": "Manga",
        "views": 24334,
        "latest_chapter": "Chapter 393",
        "source": "komiku.org"
      }
    ]
  }
}`;

export function CatalogSection({ onNavigate }: CatalogSectionProps) {
  const { userProfile, openAuthModal } = useAuth();
  const [category, setCategory] = useState<'terupdate' | 'terpopuler' | 'trending' | 'rekomendasi'>('terupdate');
  const [typeFilter, setTypeFilter] = useState<'all' | ComicType>('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [genresList, setGenresList] = useState<string[]>([]);
  const [items, setItems] = useState<ComicSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [jsonModalPath, setJsonModalPath] = useState<string | null>(null);
  const [coverStage, setCoverStage] = useState<Record<number, 'proxy' | 'broken'>>({});
  const [stats, setStats] = useState<{ total_titles: number; upstream_source?: string; cache: CacheStats } | null>(null);

  useEffect(() => {
    fetch('/api/public/stats')
      .then((r) => r.json())
      .then((json: { status: boolean; data?: { total_titles: number; upstream_source?: string; cache: CacheStats } }) => {
        if (json.status && json.data) {
          setStats(json.data);
        }
      })
      .catch(() => {});

    fetch('/api/public/filters')
      .then((r) => r.json())
      .then((json: { status: boolean; data?: KomikuFilters }) => {
        if (json.status && json.data) {
          setGenresList(json.data.genres);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      category,
      type: typeFilter,
      genre: genreFilter,
      q: searchQuery,
      limit: '24',
    });

    fetch(`/api/public/catalog?${params.toString()}`)
      .then((r) => r.json())
      .then((json: { status: boolean; data?: { items: ComicSummary[]; upstream_source?: string } }) => {
        if (!cancelled && json.status && json.data) {
          setItems(json.data.items);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, typeFilter, genreFilter, searchQuery]);

  const buildActiveJsonPath = (): string => {
    if (searchQuery.trim()) {
      const p = new URLSearchParams({ q: searchQuery.trim(), limit: '24' });
      if (typeFilter !== 'all') p.set('type', typeFilter);
      if (genreFilter !== 'all') p.set('genre', genreFilter);
      return `/api/v1/komik/search?${p.toString()}`;
    }
    const p = new URLSearchParams({ limit: '24' });
    if (typeFilter !== 'all') p.set('type', typeFilter);
    if (genreFilter !== 'all') p.set('genre', genreFilter);
    return `/api/v1/komik/${category}?${p.toString()}`;
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
    <div className="space-y-12">
      {/* Hero Split */}
      <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        <div className="flex flex-col justify-center space-y-6 lg:col-span-7">
          <p className="text-xs font-medium tracking-wide text-rose-700">
            Live Scraper Komiku.org · Manga · Manhwa · Manhua Bahasa Indonesia
          </p>
          <h1
            className="font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl"
            style={{ textWrap: 'balance' }}
          >
            Ambil data komik Komiku langsung dalam format JSON cepat.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-slate-600">
            Menarik data live langsung dari sumber resmi Komiku (komiku.org) untuk daftar terupdate, terpopuler, trending, filter per tipe & genre, detail rating/author/rilis, reader chapter, hingga perpustakaan berhalaman — siap diakses langsung dari web tanpa cURL.
          </p>

          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            {userProfile ? (
              <button
                type="button"
                onClick={() => onNavigate('apikey')}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-800 whitespace-nowrap"
              >
                Lihat API Key Saya
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-800 whitespace-nowrap"
              >
                Masuk / Daftar Ambil API Key
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('berwarna')}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              Komik Berwarna
            </button>
            <button
              type="button"
              onClick={() => onNavigate('perpustakaan')}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              Buka Perpustakaan Komiku
            </button>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs">
              <span className="font-mono text-slate-300 truncate">GET /api/v1/komik/terupdate</span>
              <span className="font-mono text-emerald-400 shrink-0">200 OK · komiku.org</span>
            </div>
            <pre className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
              {SAMPLE_HERO_JSON}
            </pre>
          </div>
        </div>
      </section>

      {/* 4-column KPI strip */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs text-slate-500">Koleksi Perpustakaan</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-950 tabular-nums sm:text-2xl">
            {(stats?.total_titles ?? 8100).toLocaleString('id-ID')}+ Judul
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Sumber: {stats?.upstream_source ?? 'komiku.org'}
          </p>
        </div>
        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs text-slate-500">Rasio Cache Hit</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-950 tabular-nums sm:text-2xl">
            {stats?.cache.hitRatePercent ?? 100}%
          </p>
          <p className="mt-1 text-xs text-slate-500">L1 LRU + SWR</p>
        </div>
        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs text-slate-500">Akses JSON Langsung</p>
          <p className="mt-1 font-display text-xl font-bold text-emerald-700 sm:text-2xl">Tanpa cURL</p>
          <p className="mt-1 text-xs text-slate-500">Inspeksi & Download .json</p>
        </div>
        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs text-slate-500">Latensi Cache L1</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-950 tabular-nums sm:text-2xl">
            {stats?.cache.avgResponseMs ?? 0.4} ms
          </p>
          <p className="mt-1 text-xs text-slate-500">Singleflight anti-lonjakan</p>
        </div>
      </section>

      {/* Explorer Controls & Catalog Grid */}
      <section className="space-y-6">
        <div className="flex flex-col justify-between gap-3.5 border-b border-slate-200 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-lg bg-slate-100 p-1">
                {(
                  [
                    { id: 'terupdate', label: 'Terupdate' },
                    { id: 'terpopuler', label: 'Terpopuler' },
                    { id: 'trending', label: 'Trending' },
                    { id: 'rekomendasi', label: 'Rekomendasi' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCategory(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      category === tab.id
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-lg bg-slate-100 p-1">
                {(['all', 'Manga', 'Manhwa', 'Manhua'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                      typeFilter === t
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t === 'all' ? 'Semua Tipe' : t}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setJsonModalPath(buildActiveJsonPath())}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 whitespace-nowrap sm:w-auto"
            >
              <Code2 className="h-3.5 w-3.5 text-rose-400" />
              Ambil Respon JSON Filter Ini
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <label htmlFor="catalog-genre" className="text-xs font-medium text-slate-600 whitespace-nowrap shrink-0">
                Genre:
              </label>
              <SelectDropdown
                id="catalog-genre"
                ariaLabel="Filter genre komik"
                value={genreFilter}
                onChange={setGenreFilter}
                searchable
                searchPlaceholder="Cari genre komik..."
                className="w-full sm:w-60"
                options={[
                  { value: 'all', label: `Semua Genre (${genresList.length || 50})` },
                  ...genresList.map((g) => ({ value: g, label: g })),
                ]}
              />
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul komik di Komiku..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none"
              />
            </div>
          </div>
        </div>

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
            <p className="text-sm font-medium text-slate-900">Komik tidak ditemukan untuk filter ini.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
                setGenreFilter('all');
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
                        {comic.rank ? `#${comic.rank} · ` : ''}
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
                      <span>
                        {comic.views > 0
                          ? `${comic.views.toLocaleString('id-ID')} views`
                          : comic.updated_label}
                      </span>
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {selectedSlug && <ComicDetailModal slug={selectedSlug} onClose={() => setSelectedSlug(null)} />}
      {jsonModalPath && (
        <JsonResponseModal
          apiPath={jsonModalPath}
          title="Respon JSON Endpoint Komiku"
          onClose={() => setJsonModalPath(null)}
        />
      )}
    </div>
  );
}
