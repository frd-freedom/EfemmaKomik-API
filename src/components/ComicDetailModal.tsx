import React, { useEffect, useState } from 'react';
import { BookOpen, Check, ChevronLeft, ChevronRight, Code2, Copy, Download, ExternalLink, Lock, X } from 'lucide-react';
import type { ChapterDetail, ComicDetail } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { JsonCodeBlock } from './JsonCodeBlock';
import { StarRating } from './StarRating';

interface ComicDetailModalProps {
  slug: string;
  onClose: () => void;
}

function formatIdDate(iso?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ComicDetailModal({ slug, onClose }: ComicDetailModalProps) {
  useBodyScrollLock(true);
  const { userProfile, openAuthModal } = useAuth();
  const activeKey = userProfile?.apiKey || '';

  const [detail, setDetail] = useState<ComicDetail | null>(null);
  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'json' | 'reader'>('overview');
  const [copied, setCopied] = useState(false);
  const [coverStage, setCoverStage] = useState<'direct' | 'proxy' | 'broken'>('direct');
  const [pageStage, setPageStage] = useState<Record<number, 'proxy' | 'broken'>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setViewMode('overview');
    setChapter(null);
    setCoverStage('direct');
    setPageStage({});

    fetch(`/api/public/detail/${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((json: { status: boolean; data?: ComicDetail }) => {
        if (!cancelled && json.status && json.data) {
          setDetail(json.data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loadChapter = async (chapterSlug: string) => {
    setChapterLoading(true);
    setViewMode('reader');
    setPageStage({});
    try {
      const res = await fetch(`/api/public/chapter/${encodeURIComponent(chapterSlug)}`);
      const json = (await res.json()) as { status: boolean; data?: ChapterDetail };
      if (json.status && json.data) {
        setChapter(json.data);
      }
    } finally {
      setChapterLoading(false);
    }
  };

  const activeApiPath =
    viewMode === 'reader' && chapter
      ? `/api/v1/komik/chapter/${encodeURIComponent(chapter.chapter_slug)}`
      : `/api/v1/komik/detail/${encodeURIComponent(slug)}`;

  const rawJsonUrl = activeKey ? `${activeApiPath}?apikey=${encodeURIComponent(activeKey)}` : '';

  const jsonPayload =
    viewMode === 'reader' && chapter
      ? JSON.stringify({ status: true, code: 200, data: chapter }, null, 2)
      : JSON.stringify({ status: true, code: 200, data: detail }, null, 2);

  const handleCopyJson = () => {
    void navigator.clipboard.writeText(jsonPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonPayload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${viewMode === 'reader' && chapter ? chapter.chapter_slug : slug}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCoverError = () => {
    if (coverStage === 'direct' && detail?.proxy_cover_url) {
      setCoverStage('proxy');
    } else {
      setCoverStage('broken');
    }
  };

  const handlePageError = (pageNum: number, hasProxy: boolean) => {
    setPageStage((prev) => {
      if (!prev[pageNum] && hasProxy) {
        return { ...prev, [pageNum]: 'proxy' };
      }
      return { ...prev, [pageNum]: 'broken' };
    });
  };

  const coverSrc =
    coverStage === 'proxy' ? detail?.proxy_cover_url || '' : detail?.cover_url || '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Detail Komik dan Respon JSON API"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 backdrop-blur-xs overscroll-none"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="min-w-0">
              <p className="font-mono text-[11px] text-slate-500 truncate dark:text-slate-400 sm:text-xs">{activeApiPath}</p>
              <h2 className="font-display text-base font-bold text-slate-900 truncate dark:text-slate-100 sm:text-lg">
                {detail?.title || 'Memuat data komik...'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal"
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 sm:hidden shrink-0"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 shrink-0 sm:justify-end">
            <div className="flex items-center overflow-x-auto no-scrollbar rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'overview'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                Info & Chapter
              </button>
              <button
                type="button"
                onClick={() => setViewMode('json')}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  viewMode === 'json'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                Respon JSON
              </button>
              {chapter && (
                <button
                  type="button"
                  onClick={() => setViewMode('reader')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    viewMode === 'reader'
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Reader
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal"
              className="hidden rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 sm:inline-flex"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {loading ? (
            <div className="space-y-4">
              <div className="h-44 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-8 w-2/3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-24 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            </div>
          ) : !detail ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Data komik tidak ditemukan.</p>
          ) : viewMode === 'json' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Struktur respon JSON dari <code className="font-mono text-slate-900 dark:text-slate-100">{activeApiPath}</code>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyJson}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Tersalin' : 'Salin JSON'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download .json
                  </button>
                  {rawJsonUrl ? (
                    <a
                      href={rawJsonUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-rose-700 dark:hover:bg-rose-600"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Buka Raw JSON
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={openAuthModal}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-800"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Masuk untuk Buka Raw JSON
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-[55vh] overflow-auto code-scroll rounded-lg bg-slate-950 p-4 dark:border dark:border-slate-800">
                <JsonCodeBlock json={jsonPayload} httpStatusLine="HTTP/1.1 200 OK" />
              </div>
            </div>
          ) : viewMode === 'reader' ? (
            <div>
              {chapterLoading ? (
                <div className="space-y-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Memuat halaman chapter...</div>
              ) : chapter ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900 tabular-nums dark:text-slate-100">
                        {chapter.comic_title} — Chapter {chapter.chapter_number}
                      </h3>
                      <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                        {chapter.chapter_title} · Rilis {chapter.released_label} · {chapter.total_pages} halaman
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!chapter.prev_chapter_slug}
                        onClick={() => chapter.prev_chapter_slug && void loadChapter(chapter.prev_chapter_slug)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        disabled={!chapter.next_chapter_slug}
                        onClick={() => chapter.next_chapter_slug && void loadChapter(chapter.next_chapter_slug)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        Berikutnya
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mx-auto max-w-xl space-y-3">
                    {chapter.pages.map((p) => {
                      const stage = pageStage[p.page];
                      const src = stage === 'proxy' ? p.proxy_image_url : p.image_url;
                      return (
                        <div key={p.page} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                          {stage === 'broken' ? (
                            <div className="p-6 text-center text-xs text-slate-300">
                              Halaman {p.page} diblokir CDN dari jaringan sandbox. URL asli tersedia di tab Respon JSON.
                            </div>
                          ) : (
                            <img
                              src={src}
                              alt={`${chapter.comic_title} Chapter ${chapter.chapter_number} halaman ${p.page}`}
                              referrerPolicy="no-referrer"
                              onError={() => handlePageError(p.page, Boolean(p.proxy_image_url))}
                              className="w-full h-auto block"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
                <div className="mx-auto w-36 shrink-0 sm:mx-0 sm:w-40">
                  {coverStage === 'broken' || !coverSrc ? (
                    <div className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-900 p-3 text-center text-white dark:border-slate-700">
                      <BookOpen className="mb-2 h-6 w-6 text-rose-400" />
                      <span className="text-xs font-medium">{detail.title}</span>
                    </div>
                  ) : (
                    <img
                      src={coverSrc}
                      alt={detail.title}
                      referrerPolicy="no-referrer"
                      onError={handleCoverError}
                      className="aspect-[3/4] w-full rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-y-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      <span>{detail.type}</span>
                      <span className="mx-2" aria-hidden="true">·</span>
                      <span>{detail.status}</span>
                      <span className="mx-2" aria-hidden="true">·</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        Usia {detail.age_rating || '13+'}
                      </span>
                      {detail.theme && (
                        <>
                          <span className="mx-2" aria-hidden="true">·</span>
                          <span>Tema {detail.theme}</span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">{detail.title}</h3>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{detail.alternative_title}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-3">
                      <StarRating rating={detail.rating} showOutOfFive />
                      {detail.rating > 0 && detail.rating_source && detail.rating_source !== 'unrated' && (
                        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Rating pasar: {detail.rating_source}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata Grid: Author, Artist, Rilis Terbaru, Total Chapter, Usia */}
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs sm:grid-cols-5 dark:border-slate-800 dark:bg-slate-950/60">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Author</p>
                      <p className="mt-0.5 font-semibold text-slate-900 truncate dark:text-slate-100">{detail.author}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Artist</p>
                      <p className="mt-0.5 font-semibold text-slate-900 truncate dark:text-slate-100">{detail.artist}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Usia</p>
                      <p className="mt-0.5 font-semibold text-slate-900 tabular-nums dark:text-slate-100">{detail.age_rating || '13+'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Rilis Terbaru</p>
                      <p className="mt-0.5 font-semibold text-slate-900 tabular-nums dark:text-slate-100">{formatIdDate(detail.released_at)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Total Chapter</p>
                      <p className="mt-0.5 font-semibold text-slate-900 tabular-nums dark:text-slate-100">{detail.chapter_count} Ch</p>
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{detail.synopsis}</p>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <span>
                      Genre:{' '}
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {detail.genres.length > 0 ? detail.genres.join(' · ') : 'Umum'}
                      </span>
                    </span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                      Ditambahkan: {formatIdDate(detail.added_at)} · Provider: EfemmaKomik-API
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                <h4 className="mb-3 font-display text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                  Daftar Chapter Bahasa Indonesia ({detail.chapters.length})
                </h4>
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                  {detail.chapters.map((ch) => (
                    <button
                      key={ch.chapter_slug}
                      type="button"
                      onClick={() => void loadChapter(ch.chapter_slug)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-4"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-900 tabular-nums dark:text-slate-100 sm:inline sm:text-sm">
                          {ch.title || `Chapter ${ch.chapter_number}`}
                        </span>
                        <span className="hidden mx-2 text-slate-300 dark:text-slate-700 sm:inline" aria-hidden="true">·</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">{ch.released_label}</span>
                      </div>
                      <span className="font-mono text-[11px] text-rose-700 shrink-0 dark:text-rose-400 sm:text-xs">Baca / JSON</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
