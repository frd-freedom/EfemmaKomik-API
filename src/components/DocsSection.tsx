import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { JsonCodeBlock } from './JsonCodeBlock';

type SnippetTab = 'curl' | 'javascript';

const CORE_ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/komik/terupdate',
    params: 'type, genre, page, limit',
    desc: 'Rilis chapter terbaru.',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/terpopuler',
    params: 'period, type, genre, page, limit',
    desc: 'Peringkat terpopuler.',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/trending',
    params: 'type, genre, page, limit',
    desc: 'Judul trending real-time.',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/rekomendasi',
    params: 'type, genre, page, limit',
    desc: 'Kurasi rekomendasi unggulan.',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/berwarna',
    params: 'page, limit, type, genre, q',
    desc: 'Koleksi komik full color.',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/perpustakaan',
    params: 'page, limit, type, genre, status, sort, q',
    desc: 'Katalog lengkap berhalaman.',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/type/:type',
    params: ':type (manga|manhwa|manhua), page, limit',
    desc: 'Filter berdasarkan tipe komik.',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/genre/:genre',
    params: ':genre, page, limit, sort',
    desc: 'Filter berdasarkan genre.',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/search',
    params: 'q, type, genre, page, limit',
    desc: 'Pencarian judul.',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/detail/:slug',
    params: ':slug',
    desc: 'Metadata, rating, author, & daftar chapter.',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/chapter/:chapterSlug',
    params: ':chapterSlug',
    desc: 'Daftar gambar halaman reader.',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/genres',
    params: '—',
    desc: 'Daftar genre, tipe, & status aktif.',
  },
];

const SAMPLE_200_JSON = `{
  "status": true,
  "code": 200,
  "meta": {
    "provider": "EfemmaKomik-API v1",
    "language": "id",
    "cache": "HIT",
    "response_time_ms": 0.42
  },
  "data": {
    "items": [
      {
        "id": 104821,
        "slug": "black-clover-indonesia",
        "title": "Black Clover",
        "type": "Manga",
        "status": "Ongoing",
        "rating": 4.0,
        "views": 24334,
        "latest_chapter": "Chapter 393"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total_items": 8100,
      "total_pages": 405
    }
  }
}`;

export function DocsSection() {
  const { userProfile } = useAuth();
  const [tab, setTab] = useState<SnippetTab>('curl');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://api.efemmakomik.dev';
  const activeKey = userProfile?.apiKey || 'API_KEY_ANDA';

  const copyText = (id: string, value: string) => {
    void navigator.clipboard.writeText(value);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const curlExample = `curl -i -sS -H "x-api-key: ${activeKey}" \\
  "${origin}/api/v1/komik/terupdate?page=1&limit=10"`;

  const jsExample = `const res = await fetch("${origin}/api/v1/komik/terupdate?page=1&limit=10", {
  headers: { "x-api-key": "${activeKey}" }
});
const json = await res.json(); // { status: true, code: 200, data }`;

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <p className="text-xs font-semibold tracking-wide text-rose-700 dark:text-rose-400">
          EfemmaKomik-API · Referensi Cepat
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
          Dokumentasi REST API
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Referensi inti autentikasi, daftar endpoint, serta format respon JSON standar{' '}
          <code className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">200 OK</code>.
        </p>
      </div>

      {/* Essential Auth & Base URL */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:divide-x sm:divide-slate-200 sm:p-0 dark:border-slate-800 dark:bg-slate-900 dark:sm:divide-slate-800">
        <div className="sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Base URL</p>
          <p className="mt-1.5 font-mono text-xs font-semibold text-slate-950 dark:text-slate-100 break-all">
            {origin}/api/v1
          </p>
        </div>
        <div className="sm:p-5">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Autentikasi</p>
          <p className="mt-1.5 font-mono text-xs text-slate-900 dark:text-slate-200">
            Header: <span className="font-semibold text-rose-700 dark:text-rose-400">x-api-key</span>
          </p>
          <p className="mt-0.5 font-mono text-xs text-slate-500 dark:text-slate-400">Query: ?apikey=KEY</p>
        </div>
      </div>

      {/* Essential Endpoints Table */}
      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-100">Endpoint Utama</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3">Method &amp; Path</th>
                <th className="px-4 py-3">Parameter Penting</th>
                <th className="px-4 py-3">Fungsi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {CORE_ENDPOINTS.map((ep) => (
                <tr key={ep.path} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                    <span className="mr-2 font-semibold text-emerald-700 dark:text-emerald-400">{ep.method}</span>
                    <span className="font-medium text-slate-950 dark:text-slate-100">{ep.path}</span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-500 dark:text-slate-400">{ep.params}</td>
                  <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{ep.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request & Colored 200 OK Response */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-800 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-2.5">
            <div className="flex items-center gap-1 rounded-md bg-slate-950 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setTab('curl')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  tab === 'curl' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                cURL
              </button>
              <button
                type="button"
                onClick={() => setTab('javascript')}
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  tab === 'javascript' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                JavaScript
              </button>
            </div>
            <button
              type="button"
              onClick={() => copyText('req', tab === 'curl' ? curlExample : jsExample)}
              className="inline-flex items-center gap-1.5 rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              {copiedKey === 'req' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copiedKey === 'req' ? 'Tersalin' : 'Salin'}
            </button>
          </div>
          <pre className="flex-1 overflow-auto code-scroll p-4 font-mono text-xs leading-relaxed text-sky-200">
            {tab === 'curl' ? curlExample : jsExample}
          </pre>
        </div>

        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-950 dark:border-slate-800 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-2.5 text-xs">
            <span className="font-mono font-semibold text-emerald-400">200 OK · Respon JSON</span>
            <span className="font-mono text-[11px] text-slate-400">application/json</span>
          </div>
          <div className="max-h-[340px] overflow-auto code-scroll p-4">
            <JsonCodeBlock
              json={SAMPLE_200_JSON}
              httpStatusLine="HTTP/1.1 200 OK"
              httpHeaders={[
                ['content-type', 'application/json; charset=utf-8'],
                ['x-anti403-status', 'curl-allowed'],
              ]}
            />
          </div>
        </div>
      </div>

      {/* Essential Schema Fields */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-display text-sm font-bold text-slate-950 dark:text-slate-100">Field Respon Utama</h2>
        <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 font-mono text-xs sm:grid-cols-2">
          <p className="text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-950 dark:text-slate-100">status / code</span> — Status boolean &amp; kode HTTP (200)
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-950 dark:text-slate-100">data.items[]</span> — Daftar judul, slug, rating, &amp; chapter
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-950 dark:text-slate-100">data.pagination</span> — page, limit, total_items, total_pages
          </p>
          <p className="text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-slate-950 dark:text-slate-100">data.chapters / pages</span> — Slug chapter &amp; URL gambar reader
          </p>
        </div>
      </div>
    </div>
  );
}
