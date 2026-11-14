import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Lock, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SelectDropdown } from './SelectDropdown';
import type { KomikuFilters } from '../types';

type EndpointId =
  | 'terupdate'
  | 'terpopuler'
  | 'trending'
  | 'rekomendasi'
  | 'berwarna'
  | 'type'
  | 'genre'
  | 'perpustakaan'
  | 'anime_perpustakaan'
  | 'search'
  | 'detail'
  | 'chapter'
  | 'genres';

const ENDPOINT_OPTIONS: Array<{ id: EndpointId; label: string; pathPreview: string }> = [
  { id: 'terupdate', label: 'Komik Terupdate', pathPreview: '/api/v1/komik/terupdate' },
  { id: 'terpopuler', label: 'Komik Terpopuler', pathPreview: '/api/v1/komik/terpopuler' },
  { id: 'trending', label: 'Komik Trending', pathPreview: '/api/v1/komik/trending' },
  { id: 'rekomendasi', label: 'Komik Rekomendasi', pathPreview: '/api/v1/komik/rekomendasi' },
  { id: 'berwarna', label: 'Komik Berwarna (Full Color)', pathPreview: '/api/v1/komik/berwarna' },
  { id: 'type', label: 'Berdasarkan Tipe (Manga/Manhwa/Manhua)', pathPreview: '/api/v1/komik/type/:type' },
  { id: 'genre', label: 'Berdasarkan Genre Komiku', pathPreview: '/api/v1/komik/genre/:genre' },
  { id: 'perpustakaan', label: 'Perpustakaan Komiku (Pagination)', pathPreview: '/api/v1/komik/perpustakaan' },
  { id: 'anime_perpustakaan', label: 'Perpustakaan Anime Komiku (Pagination)', pathPreview: '/api/v1/anime/perpustakaan' },
  { id: 'search', label: 'Pencarian Komik', pathPreview: '/api/v1/komik/search' },
  { id: 'detail', label: 'Detail Komik (Bintang, Usia, Author, Rilis)', pathPreview: '/api/v1/komik/detail/:slug' },
  { id: 'chapter', label: 'Baca Chapter & Halaman Gambar', pathPreview: '/api/v1/komik/chapter/:chapterSlug' },
  { id: 'genres', label: 'Daftar Semua Genre Komiku', pathPreview: '/api/v1/komik/genres' },
];

export function PlaygroundSection() {
  const { userProfile, openAuthModal, refreshUsage } = useAuth();
  const [endpoint, setEndpoint] = useState<EndpointId>('terupdate');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [typeParam, setTypeParam] = useState('all');
  const [genreParam, setGenreParam] = useState('all');
  const [genresList, setGenresList] = useState<string[]>(['Action', 'Adventure', 'Fantasy', 'Isekai', 'Romance']);
  const [pageParam, setPageParam] = useState('1');
  const [searchQ, setSearchQ] = useState('black clover');
  const [slugParam, setSlugParam] = useState('black-clover-indonesia');
  const [chapterParam, setChapterParam] = useState('black-clover-chapter-393');
  const [limitParam, setLimitParam] = useState('10');
  const [running, setRunning] = useState(false);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [headersInfo, setHeadersInfo] = useState<Record<string, string>>({});
  const [responseJson, setResponseJson] = useState<string>('');
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  useEffect(() => {
    fetch('/api/public/filters')
      .then((r) => r.json())
      .then((json: { status: boolean; data?: KomikuFilters }) => {
        if (json.status && json.data && json.data.genres.length > 0) {
          setGenresList(json.data.genres);
        }
      })
      .catch(() => {});
  }, []);

  const effectiveKey = apiKeyInput.trim() || userProfile?.apiKey || '';

  const buildRequestPath = (): string => {
    if (endpoint === 'detail') return `/api/v1/komik/detail/${encodeURIComponent(slugParam.trim())}`;
    if (endpoint === 'chapter') return `/api/v1/komik/chapter/${encodeURIComponent(chapterParam.trim())}`;
    if (endpoint === 'genres') return '/api/v1/komik/genres';

    const params = new URLSearchParams();
    params.set('page', pageParam || '1');
    params.set('limit', limitParam || '10');

    if (endpoint === 'type') {
      const selectedType = typeParam === 'all' ? 'manhwa' : typeParam.toLowerCase();
      return `/api/v1/komik/type/${encodeURIComponent(selectedType)}?${params.toString()}`;
    }
    if (endpoint === 'genre') {
      const selectedGenre = genreParam === 'all' ? 'Action' : genreParam;
      return `/api/v1/komik/genre/${encodeURIComponent(selectedGenre)}?${params.toString()}`;
    }
    if (endpoint === 'anime_perpustakaan') {
      return `/api/v1/anime/perpustakaan?${params.toString()}`;
    }
    if (typeParam !== 'all') params.set('type', typeParam);
    if (genreParam !== 'all') params.set('genre', genreParam);
    if (endpoint === 'search') {
      params.set('q', searchQ);
    }
    return `/api/v1/komik/${endpoint}?${params.toString()}`;
  };

  const requestPath = buildRequestPath();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const displayKey = effectiveKey || 'MASUKKAN_API_KEY_ANDA';
  const rawTabUrl = effectiveKey
    ? `${requestPath}${requestPath.includes('?') ? '&' : '?'}apikey=${encodeURIComponent(effectiveKey)}`
    : '';
  const curlCommand = `curl -i -H "x-api-key: ${displayKey}" "${origin}${requestPath}"`;

  const runRequest = async () => {
    if (!effectiveKey) {
      setStatusLine('401 API Key Diperlukan');
      setHeadersInfo({});
      setResponseJson(
        JSON.stringify(
          {
            status: false,
            code: 401,
            message: 'Silakan masuk via Email atau Google OAuth terlebih dahulu, atau tempel API Key pribadi Anda.',
          },
          null,
          2
        )
      );
      return;
    }
    setRunning(true);
    try {
      const res = await fetch(requestPath, {
        headers: {
          'x-api-key': effectiveKey,
          Accept: 'application/json',
        },
      });
      setStatusLine(`${res.status} ${res.statusText}`);
      const capturedHeaders: Record<string, string> = {};
      for (const h of [
        'X-Cache',
        'X-Cache-TTL',
        'X-Response-Time',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining',
        'X-Anti403-Status',
      ]) {
        const val = res.headers.get(h);
        if (val) capturedHeaders[h] = val;
      }
      setHeadersInfo(capturedHeaders);
      const data = await res.json();
      setResponseJson(JSON.stringify(data, null, 2));
      if (userProfile) {
        void refreshUsage();
      }
    } catch (err) {
      setStatusLine('Error');
      setResponseJson(JSON.stringify({ error: err instanceof Error ? err.message : 'Request gagal' }, null, 2));
    } finally {
      setRunning(false);
    }
  };

  const copyJson = () => {
    if (!responseJson) return;
    void navigator.clipboard.writeText(responseJson);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1800);
  };

  const downloadJson = () => {
    if (!responseJson) return;
    const blob = new Blob([responseJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `komiku-${endpoint}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyCurl = () => {
    void navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 1800);
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5 sm:pb-6">
        <p className="text-xs font-medium tracking-wide text-rose-700">
          Zero-cURL JSON Retriever · Sesi Browser Langsung
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Ambil Respon JSON Langsung (Tanpa Perlu cURL)
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Karena domain preview AI Studio memproteksi akses CLI luar dengan halaman Cookie check, gunakan pengambil JSON di bawah untuk memanggil endpoint Komiku langsung dari browser, mengunduh file <code className="font-mono text-slate-900">.json</code>, atau membuka URL JSON mentah di tab baru.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls Column */}
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 lg:col-span-5">
          <div>
            <label htmlFor="pg-endpoint" className="block text-xs font-semibold text-slate-700">
              Pilih Endpoint Komiku
            </label>
            <SelectDropdown
              id="pg-endpoint"
              ariaLabel="Pilih endpoint Komiku"
              value={endpoint}
              onChange={(next) => setEndpoint(next as EndpointId)}
              searchable
              searchPlaceholder="Cari endpoint..."
              className="mt-1.5 w-full"
              options={ENDPOINT_OPTIONS.map((opt) => ({
                value: opt.id,
                label: `${opt.label} (${opt.pathPreview})`,
              }))}
            />
          </div>

          <div>
            <label htmlFor="pg-apikey" className="block text-xs font-semibold text-slate-700">
              API Key (`x-api-key` atau `?apikey=`)
            </label>
            <input
              id="pg-apikey"
              type="text"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={userProfile?.apiKey || 'Masuk untuk mendapatkan API Key pribadi'}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none"
            />
            {!effectiveKey && (
              <button
                type="button"
                onClick={openAuthModal}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800"
              >
                <Lock className="h-3.5 w-3.5" />
                Masuk via Email atau Google untuk ambil API Key
              </button>
            )}
          </div>

          {['terupdate', 'terpopuler', 'trending', 'rekomendasi', 'berwarna', 'type', 'perpustakaan'].includes(endpoint) && (
            <div>
              <label htmlFor="pg-type" className="block text-xs font-semibold text-slate-700">
                Tipe Komik
              </label>
              <SelectDropdown
                id="pg-type"
                ariaLabel="Tipe komik"
                value={typeParam === 'all' && endpoint === 'type' ? 'Manhwa' : typeParam}
                onChange={setTypeParam}
                className="mt-1.5 w-full"
                options={[
                  ...(endpoint !== 'type' ? [{ value: 'all', label: 'Semua Tipe' }] : []),
                  { value: 'Manga', label: 'Manga' },
                  { value: 'Manhwa', label: 'Manhwa' },
                  { value: 'Manhua', label: 'Manhua' },
                ]}
              />
            </div>
          )}

          {['terupdate', 'terpopuler', 'trending', 'rekomendasi', 'berwarna', 'genre', 'perpustakaan'].includes(endpoint) && (
            <div>
              <label htmlFor="pg-genre" className="block text-xs font-semibold text-slate-700">
                Genre Komiku
              </label>
              <SelectDropdown
                id="pg-genre"
                ariaLabel="Genre Komiku"
                value={genreParam === 'all' && endpoint === 'genre' ? 'Action' : genreParam}
                onChange={setGenreParam}
                searchable
                searchPlaceholder="Cari genre..."
                className="mt-1.5 w-full"
                options={[
                  ...(endpoint !== 'genre' ? [{ value: 'all', label: 'Semua Genre' }] : []),
                  ...genresList.map((g) => ({ value: g, label: g })),
                ]}
              />
            </div>
          )}

          {endpoint !== 'detail' && endpoint !== 'chapter' && endpoint !== 'genres' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pg-page" className="block text-xs font-semibold text-slate-700">
                  Halaman (`page`)
                </label>
                <input
                  id="pg-page"
                  type="number"
                  min={1}
                  value={pageParam}
                  onChange={(e) => setPageParam(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-rose-700 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="pg-limit" className="block text-xs font-semibold text-slate-700">
                  Limit (`limit`)
                </label>
                <input
                  id="pg-limit"
                  type="number"
                  min={1}
                  max={48}
                  value={limitParam}
                  onChange={(e) => setLimitParam(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-rose-700 focus:outline-none"
                />
              </div>
            </div>
          )}

          {endpoint === 'search' && (
            <div>
              <label htmlFor="pg-q" className="block text-xs font-semibold text-slate-700">
                Kata Kunci (`q`)
              </label>
              <input
                id="pg-q"
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-rose-700 focus:outline-none"
              />
            </div>
          )}

          {endpoint === 'detail' && (
            <div>
              <label htmlFor="pg-slug" className="block text-xs font-semibold text-slate-700">
                Slug Komik Komiku
              </label>
              <input
                id="pg-slug"
                type="text"
                value={slugParam}
                onChange={(e) => setSlugParam(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-rose-700 focus:outline-none"
              />
            </div>
          )}

          {endpoint === 'chapter' && (
            <div>
              <label htmlFor="pg-chapter" className="block text-xs font-semibold text-slate-700">
                Chapter Slug Komiku
              </label>
              <input
                id="pg-chapter"
                type="text"
                value={chapterParam}
                onChange={(e) => setChapterParam(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-rose-700 focus:outline-none"
              />
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={running}
              onClick={() => void runRequest()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-800 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {running ? 'Mengambil Respon JSON...' : 'Ambil Respon JSON (Tanpa cURL)'}
            </button>

            {rawTabUrl ? (
              <a
                href={rawTabUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Buka Raw JSON di Tab Browser Baru
              </a>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50"
              >
                <Lock className="h-3.5 w-3.5 text-rose-700" />
                Masuk untuk Buka Raw JSON
              </button>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Opsional: cURL (Untuk Deploy Publik)</span>
              <button
                type="button"
                onClick={copyCurl}
                className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 hover:text-rose-800"
              >
                {copiedCurl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCurl ? 'Tersalin' : 'Salin cURL'}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-200">
              {curlCommand}
            </pre>
          </div>
        </div>

        {/* Output Column */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-slate-100 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3 text-xs">
            <span className="font-mono text-slate-300 truncate">{requestPath}</span>
            <div className="flex items-center gap-2">
              {statusLine && (
                <span
                  className={`font-mono font-semibold ${
                    statusLine.startsWith('200') ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {statusLine}
                </span>
              )}
              {responseJson && (
                <>
                  <button
                    type="button"
                    onClick={copyJson}
                    className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                  >
                    {copiedJson ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copiedJson ? 'Tersalin' : 'Salin'}
                  </button>
                  <button
                    type="button"
                    onClick={downloadJson}
                    className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                  >
                    <Download className="h-3 w-3" />
                    .json
                  </button>
                </>
              )}
            </div>
          </div>

          {Object.keys(headersInfo).length > 0 && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-800 bg-slate-900/60 px-4 py-2 font-mono text-[11px] text-slate-300 tabular-nums">
              {Object.entries(headersInfo).map(([k, v]) => (
                <span key={k}>
                  <span className="text-slate-500">{k}:</span> {v}
                </span>
              ))}
            </div>
          )}

          <pre className="min-h-[420px] max-h-[620px] flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-100">
            {responseJson || '// Klik "Ambil Respon JSON (Tanpa cURL)" untuk menarik respon JSON langsung dari Komiku.org.'}
          </pre>
        </div>
      </div>
    </div>
  );
}
