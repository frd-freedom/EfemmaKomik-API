import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Lock, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { JsonCodeBlock } from './JsonCodeBlock';
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
  { id: 'genre', label: 'Berdasarkan Genre', pathPreview: '/api/v1/komik/genre/:genre' },
  { id: 'perpustakaan', label: 'Perpustakaan Lengkap (Pagination)', pathPreview: '/api/v1/komik/perpustakaan' },
  { id: 'anime_perpustakaan', label: 'Perpustakaan Anime (Pagination)', pathPreview: '/api/v1/anime/perpustakaan' },
  { id: 'search', label: 'Pencarian Komik', pathPreview: '/api/v1/komik/search' },
  { id: 'detail', label: 'Detail Komik (Rating, Author, Rilis)', pathPreview: '/api/v1/komik/detail/:slug' },
  { id: 'chapter', label: 'Baca Chapter & Halaman Gambar', pathPreview: '/api/v1/komik/chapter/:chapterSlug' },
  { id: 'genres', label: 'Daftar Semua Genre', pathPreview: '/api/v1/komik/genres' },
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
  const [headersList, setHeadersList] = useState<Array<[string, string]>>([]);
  const [responseJson, setResponseJson] = useState<string>('');
  const [outputTab, setOutputTab] = useState<'curl' | 'json'>('curl');
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [copiedCurlCmd, setCopiedCurlCmd] = useState(false);

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
  const curlCommand = `curl -i -sS -H "x-api-key: ${displayKey}" "${origin}${requestPath}"`;

  const runRequest = async () => {
    if (!effectiveKey) {
      setStatusLine('HTTP/1.1 401 Unauthorized');
      setHeadersList([['content-type', 'application/json; charset=utf-8']]);
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
      setStatusLine(`HTTP/1.1 ${res.status} ${res.statusText || (res.status === 200 ? 'OK' : '')}`.trim());
      const capturedHeaders: Array<[string, string]> = [];
      for (const h of [
        'content-type',
        'x-cache',
        'x-cache-ttl',
        'x-response-time',
        'x-ratelimit-limit',
        'x-ratelimit-remaining',
        'x-anti403-status',
        'etag',
      ]) {
        const val = res.headers.get(h);
        if (val) capturedHeaders.push([h, val]);
      }
      setHeadersList(capturedHeaders);
      const data = await res.json();
      setResponseJson(JSON.stringify(data, null, 2));
      if (userProfile) {
        void refreshUsage();
      }
    } catch (err) {
      setStatusLine('HTTP/1.1 500 Error');
      setResponseJson(JSON.stringify({ error: err instanceof Error ? err.message : 'Request gagal' }, null, 2));
    } finally {
      setRunning(false);
    }
  };

  const fullCurlResponseText = statusLine
    ? `${statusLine}\n${headersList.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${responseJson}`
    : responseJson;

  const copyOutput = () => {
    if (!responseJson) return;
    void navigator.clipboard.writeText(outputTab === 'curl' ? fullCurlResponseText : responseJson);
    setCopiedOutput(true);
    setTimeout(() => setCopiedOutput(false), 1800);
  };

  const downloadJson = () => {
    if (!responseJson) return;
    const blob = new Blob([responseJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `efemmakomik-${endpoint}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyCurlCmd = () => {
    void navigator.clipboard.writeText(curlCommand);
    setCopiedCurlCmd(true);
    setTimeout(() => setCopiedCurlCmd(false), 1800);
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5 sm:pb-6 dark:border-slate-800">
        <p className="text-xs font-semibold tracking-wide text-rose-700 dark:text-rose-400">
          EfemmaKomik-API · Interactive REST Console
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
          Akses JSON &amp; Respon cURL (200 OK)
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Uji seluruh endpoint REST API secara langsung dan dapatkan respon lengkap{' '}
          <code className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">HTTP/1.1 200 OK</code> beserta header cURL dan payload JSON berwarna.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Controls Column */}
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900 lg:col-span-5">
          <div>
            <label htmlFor="pg-endpoint" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Pilih Endpoint API
            </label>
            <SelectDropdown
              id="pg-endpoint"
              ariaLabel="Pilih endpoint API"
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
            <label htmlFor="pg-apikey" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              API Key (`x-api-key` atau `?apikey=`)
            </label>
            <input
              id="pg-apikey"
              type="text"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={userProfile?.apiKey || 'Masuk untuk mendapatkan API Key pribadi'}
              className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-rose-500"
            />
            {!effectiveKey && (
              <button
                type="button"
                onClick={openAuthModal}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
              >
                <Lock className="h-3.5 w-3.5" />
                Masuk via Email atau Google untuk ambil API Key
              </button>
            )}
          </div>

          {['terupdate', 'terpopuler', 'trending', 'rekomendasi', 'berwarna', 'type', 'perpustakaan'].includes(endpoint) && (
            <div>
              <label htmlFor="pg-type" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
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
              <label htmlFor="pg-genre" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Genre
              </label>
              <SelectDropdown
                id="pg-genre"
                ariaLabel="Filter genre"
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
                <label htmlFor="pg-page" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Halaman (`page`)
                </label>
                <input
                  id="pg-page"
                  type="number"
                  min={1}
                  value={pageParam}
                  onChange={(e) => setPageParam(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-rose-500"
                />
              </div>
              <div>
                <label htmlFor="pg-limit" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Limit (`limit`)
                </label>
                <input
                  id="pg-limit"
                  type="number"
                  min={1}
                  max={48}
                  value={limitParam}
                  onChange={(e) => setLimitParam(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-rose-500"
                />
              </div>
            </div>
          )}

          {endpoint === 'search' && (
            <div>
              <label htmlFor="pg-q" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Kata Kunci (`q`)
              </label>
              <input
                id="pg-q"
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-rose-500"
              />
            </div>
          )}

          {endpoint === 'detail' && (
            <div>
              <label htmlFor="pg-slug" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Slug Komik
              </label>
              <input
                id="pg-slug"
                type="text"
                value={slugParam}
                onChange={(e) => setSlugParam(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-rose-500"
              />
            </div>
          )}

          {endpoint === 'chapter' && (
            <div>
              <label htmlFor="pg-chapter" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Chapter Slug
              </label>
              <input
                id="pg-chapter"
                type="text"
                value={chapterParam}
                onChange={(e) => setChapterParam(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-rose-500"
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
              {running ? 'Mengambil Respon 200 OK...' : 'Kirim Request & Tampilkan Respon cURL'}
            </button>

            {rawTabUrl ? (
              <a
                href={rawTabUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Buka Link Raw JSON
              </a>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <Lock className="h-3.5 w-3.5 text-rose-700 dark:text-rose-400" />
                Masuk untuk Buka Link Raw JSON
              </button>
            )}
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Perintah cURL</span>
              <button
                type="button"
                onClick={copyCurlCmd}
                className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
              >
                {copiedCurlCmd ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCurlCmd ? 'Tersalin' : 'Salin cURL'}
              </button>
            </div>
            <pre className="overflow-x-auto code-scroll rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-sky-200 dark:border dark:border-slate-800">
              {curlCommand}
            </pre>
          </div>
        </div>

        {/* Output Column */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-slate-100 dark:border-slate-800 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/70 px-4 py-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[11px] font-semibold text-sky-400 shrink-0">GET</span>
              <span className="font-mono text-slate-300 truncate">{requestPath}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {statusLine && (
                <span
                  className={`font-mono font-semibold ${
                    statusLine.includes('200') ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {statusLine}
                </span>
              )}

              <div className="flex items-center rounded-md bg-slate-950 p-0.5 border border-slate-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setOutputTab('curl')}
                  className={`rounded px-2 py-0.5 font-medium transition-colors whitespace-nowrap ${
                    outputTab === 'curl' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Respon cURL
                </button>
                <button
                  type="button"
                  onClick={() => setOutputTab('json')}
                  className={`rounded px-2 py-0.5 font-medium transition-colors whitespace-nowrap ${
                    outputTab === 'json' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  JSON Body
                </button>
              </div>

              {responseJson && (
                <>
                  <button
                    type="button"
                    onClick={copyOutput}
                    className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
                  >
                    {copiedOutput ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    {copiedOutput ? 'Tersalin' : 'Salin'}
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

          <div className="min-h-[440px] max-h-[640px] flex-1 overflow-auto code-scroll p-4">
            {responseJson ? (
              <JsonCodeBlock
                json={responseJson}
                httpStatusLine={outputTab === 'curl' && statusLine ? statusLine : undefined}
                httpHeaders={outputTab === 'curl' && headersList.length > 0 ? headersList : undefined}
                showLineNumbers
              />
            ) : (
              <div className="font-mono text-xs leading-relaxed text-slate-500">
                Klik &quot;Kirim Request &amp; Tampilkan Respon cURL&quot; untuk melihat respon HTTP/1.1 200 OK beserta JSON berwarna.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
