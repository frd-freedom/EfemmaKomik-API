import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type CodeLang = 'javascript' | 'python' | 'php' | 'curl';

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/api/v1/komik/terupdate',
    desc: 'Daftar komik dengan rilis chapter bahasa Indonesia terbaru langsung dari Komiku.org.',
    params: '?type=all|Manga|Manhwa|Manhua & genre=all & page=1 & limit=20',
    ttl: '300 detik (SWR 600s)',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/terpopuler',
    desc: 'Peringkat Komiku resmi berdasarkan tayangan harian/mingguan/bulanan atau filter tipe & genre.',
    params: '?period=harian|mingguan|bulanan|total & type=all & genre=all & page=1 & limit=20',
    ttl: '900 detik (SWR 1800s)',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/trending',
    desc: 'Komik yang sedang ramai dibaca real-time di Komiku.org, mendukung filter tipe & genre.',
    params: '?type=all|Manga|Manhwa|Manhua & genre=all & page=1 & limit=20',
    ttl: '600 detik (SWR 1200s)',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/rekomendasi',
    desc: 'Kurasi komik rekomendasi unggulan dari Komiku, mendukung filter tipe & genre.',
    params: '?type=all|Manga|Manhwa|Manhua & genre=all & page=1 & limit=20',
    ttl: '900 detik',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/berwarna',
    desc: 'Koleksi komik berwarna (full color) dari Komiku.org/other/berwarna/ dengan pagination.',
    params: '?page=1 & limit=10 & type=all & genre=all & q=',
    ttl: '300 detik (SWR 900s)',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/type/:type',
    desc: 'Filter komik berdasarkan tipe (:type = manga, manhwa, atau manhua) lengkap dengan pagination.',
    params: '?page=1 & limit=24 & sort=latest|popular|rating',
    ttl: '600 detik',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/genre/:genre',
    desc: 'Filter komik berdasarkan salah satu dari 60 genre resmi Komiku (Action, Isekai, Adaptation, dll).',
    params: '?page=1 & limit=24 & type=Manhwa & sort=latest|popular|rating',
    ttl: '600 detik',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/perpustakaan',
    desc: 'Perpustakaan lengkap Komiku.org (6.584+ judul) dengan pagination penuh, filter status, genre, tipe, & sort.',
    params: '?page=1 & limit=24 & type=all & genre=all & status=Ongoing & sort=latest',
    ttl: '600 detik',
  },
  {
    method: 'GET',
    path: '/api/v1/anime/perpustakaan',
    desc: 'Alias perpustakaan seri & adaptasi anime dari Komiku.org dengan dukungan pagination.',
    params: '?page=1 & limit=24 & genre=Adaptation & sort=popular',
    ttl: '600 detik',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/search',
    desc: 'Pencarian judul komik langsung ke endpoint pencarian Komiku.org.',
    params: '?q=solo & limit=20',
    ttl: '300 detik',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/detail/:slug',
    desc: 'Detail lengkap komik: rating, author, artist, released_at, added_at, chapter_count, sinopsis, dan daftar chapter.',
    params: ':slug (contoh: black-clover-indonesia)',
    ttl: '900 detik',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/chapter/:chapterSlug',
    desc: 'Reader chapter: daftar seluruh URL gambar halaman, proxy_image_url, prev_chapter_slug & next_chapter_slug.',
    params: ':chapterSlug (contoh: black-clover-chapter-393)',
    ttl: '1800 detik',
  },
  {
    method: 'GET',
    path: '/api/v1/komik/genres',
    desc: 'Daftar seluruh 60 genre, tipe (Manga/Manhwa/Manhua), dan status yang didukung Komiku.org.',
    params: 'Tanpa parameter wajib',
    ttl: '3600 detik',
  },
];

export function DocsSection() {
  const { userProfile } = useAuth();
  const [lang, setLang] = useState<CodeLang>('javascript');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://domain-anda.run.app';
  const activeKey = userProfile?.apiKey || 'MASUKKAN_API_KEY_ANDA';

  const copyText = (id: string, value: string) => {
    void navigator.clipboard.writeText(value);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const snippets: Record<CodeLang, string> = {
    javascript: `const API_KEY = "${activeKey}";
const BASE_URL = "${origin}/api/v1/komik";

async function ambilKomikDanChapter() {
  // 1. Ambil daftar Manhwa atau per Genre dari Komiku
  const res = await fetch(\`\${BASE_URL}/type/manhwa?page=1&limit=10\`, {
    headers: { "x-api-key": API_KEY }
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message);

  const slugPertama = json.data.items[0].slug;

  // 2. Ambil detail komik (rating, author, rilis, daftar chapter)
  const detailRes = await fetch(\`\${BASE_URL}/detail/\${slugPertama}\`, {
    headers: { "x-api-key": API_KEY }
  });
  const detailJson = await detailRes.json();
  const chapterPertama = detailJson.data.chapters[0].chapter_slug;

  // 3. Ambil halaman gambar untuk Reader
  const chRes = await fetch(\`\${BASE_URL}/chapter/\${chapterPertama}\`, {
    headers: { "x-api-key": API_KEY }
  });
  const chJson = await chRes.json();
  return chJson.data.pages; // [{ page, image_url, proxy_image_url }]
}`,

    python: `import requests

API_KEY = "${activeKey}"
BASE_URL = "${origin}/api/v1/komik"
HEADERS = {"x-api-key": API_KEY}

# 1. Ambil Perpustakaan Komiku dengan pagination
resp = requests.get(f"{BASE_URL}/perpustakaan", params={"page": 1, "limit": 24, "genre": "Action"}, headers=HEADERS, timeout=10)
resp.raise_for_status()
data = resp.json()

for komik in data["data"]["items"]:
    print(f"{komik['title']} ({komik['type']}) · Rating {komik['rating']} · {komik['latest_chapter']}")

# 2. Ambil detail (author, rilis, rating) & reader chapter
slug = data["data"]["items"][0]["slug"]
detail = requests.get(f"{BASE_URL}/detail/{slug}", headers=HEADERS).json()["data"]
print("Author:", detail["author"], "| Rilis:", detail["released_at"])

ch_slug = detail["chapters"][0]["chapter_slug"]
pages = requests.get(f"{BASE_URL}/chapter/{ch_slug}", headers=HEADERS).json()["data"]["pages"]
print("Total halaman reader:", len(pages))`,

    php: `<?php
$apiKey = "${activeKey}";
$url = "${origin}/api/v1/komik/genre/Isekai?page=1&limit=12";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "x-api-key: " . $apiKey,
        "Accept: application/json"
    ],
]);

$response = curl_exec($ch);
curl_close($ch);

$json = json_decode($response, true);
foreach ($json["data"]["items"] as $komik) {
    echo $komik["title"] . " · Rating " . $komik["rating"] . PHP_EOL;
}`,

    curl: `# Catatan: Pada host preview ais-dev, gunakan tab "Ambil JSON" atau ?apikey= di browser.
# Pada deploy Cloud Run publik / VPS sendiri, cURL langsung menerima 200 OK JSON:

# 1. Ambil berdasarkan tipe (manga | manhwa | manhua)
curl -s -H "x-api-key: ${activeKey}" \\
  "${origin}/api/v1/komik/type/manhwa?page=1&limit=5"

# 2. Ambil berdasarkan genre Komiku
curl -s -H "x-api-key: ${activeKey}" \\
  "${origin}/api/v1/komik/genre/Action?page=1&limit=5"

# 3. Ambil Perpustakaan Komiku dengan pagination
curl -s -H "x-api-key: ${activeKey}" \\
  "${origin}/api/v1/komik/perpustakaan?page=2&limit=24"

# 4. Ambil detail (rating, author, rilis) & reader
curl -s -H "x-api-key: ${activeKey}" \\
  "${origin}/api/v1/komik/detail/black-clover-indonesia"`,
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="border-b border-slate-200 pb-5 sm:pb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Dokumentasi API Komiku.org & Panduan Respon JSON
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
          Panduan mengambil respon JSON secara langsung dari web tanpa perlu <code className="font-mono text-slate-900">curl</code>, daftar lengkap endpoint per kategori, tipe, genre, komik berwarna, perpustakaan berhalaman, serta integrasi kode produksi.
        </p>
      </div>

      {/* Zero-cURL & Authentication cards */}
      <div className="grid grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900">
            1. Mengambil Respon JSON Tanpa cURL (Anti Cookie Check)
          </h2>
          <ul className="space-y-2.5 text-sm text-slate-600">
            <li>
              <span className="font-semibold text-slate-900">Mengapa cURL Muncul Cookie Check:</span> Host preview AI Studio (<code className="font-mono text-xs">ais-dev-*.run.app</code>) mewajibkan cookie sesi browser sebelum meneruskan request ke Node.js.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Solusi Langsung dari Web Ini:</span> Gunakan tombol <span className="font-semibold text-slate-900">Ambil Respon JSON</span> di Katalog, Perpustakaan, atau tab <span className="font-semibold text-slate-900">Ambil JSON</span>. Anda bisa melihat hasil JSON live, mengunduh file <code className="font-mono text-xs">.json</code>, atau klik <span className="font-semibold text-slate-900">Buka Raw JSON</span> di tab browser baru menggunakan sesi cookie Anda sendiri.
            </li>
            <li>
              <span className="font-semibold text-slate-900">Saat Deploy Publik (VPS / Cloud Run):</span> Server Express sudah memasang header CORS & anti-403 sehingga <code className="font-mono text-xs">curl</code> langsung mendapat <code className="font-mono text-xs">200 OK</code>.
            </li>
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="font-display text-lg font-bold text-slate-900">2. Autentikasi API Key & Cache L1</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Pengguna terdaftar (via Email atau Google OAuth) mendapat kuota <span className="font-semibold text-slate-900 tabular-nums">1.000 request/hari</span>, sedangkan Admin mendapat kuota <span className="font-semibold text-slate-900">Unlimited</span>. Semua respon di-cache memakai L1 LRU + Stale-While-Revalidate untuk menjaga server upstream Komiku tetap ringan.
          </p>
          <div className="rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-100 space-y-1.5">
            <p className="text-slate-400"># URL langsung di tab browser (tanpa cURL):</p>
            <p className="break-all">{origin}/api/v1/komik/terupdate?apikey={activeKey}</p>
            <p className="pt-2 text-slate-400"># Atau header request:</p>
            <p>x-api-key: {activeKey}</p>
          </div>
        </div>
      </div>

      {/* Endpoints Reference Table */}
      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold text-slate-900">3. Daftar Lengkap Endpoint Komiku</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
              <tr>
                <th className="px-4 py-3">Endpoint</th>
                <th className="px-4 py-3">Deskripsi</th>
                <th className="px-4 py-3">Parameter</th>
                <th className="px-4 py-3 text-right">TTL Cache</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {ENDPOINTS.map((ep) => (
                <tr key={ep.path} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono text-xs font-medium text-rose-700 whitespace-nowrap">
                    {ep.method} {ep.path}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 max-w-sm">{ep.desc}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{ep.params}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {ep.ttl}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code Examples */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-xl font-bold text-slate-900">
            4. Contoh Implementasi Pengambilan JSON
          </h2>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-lg bg-slate-100 p-1">
            {(
              [
                { id: 'javascript', label: 'JavaScript' },
                { id: 'python', label: 'Python' },
                { id: 'php', label: 'PHP' },
                { id: 'curl', label: 'cURL (Publik)' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLang(item.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  lang === item.id ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
            <span className="font-mono text-xs text-slate-400">Contoh kode ({lang})</span>
            <button
              type="button"
              onClick={() => copyText('snippet', snippets[lang])}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-800"
            >
              {copiedKey === 'snippet' ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copiedKey === 'snippet' ? 'Tersalin' : 'Salin Kode'}
            </button>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-100">
            {snippets[lang]}
          </pre>
        </div>
      </div>

      {/* JSON Field Structure */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <h2 className="font-display text-lg font-bold text-slate-900">
          5. Pemetaan Field Respon JSON Komiku
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 text-xs">
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900">Detail Komik (`/detail/:slug`)</h3>
            <ul className="space-y-1.5 font-mono text-slate-600">
              <li><span className="text-slate-900">data.rating</span> — Rating bintang komik skala 5 (contoh: 4.8)</li>
              <li><span className="text-slate-900">data.age_rating</span> — Batas usia pembaca (contoh: 13+, 17+)</li>
              <li><span className="text-slate-900">data.author / data.artist</span> — Nama pengarang & ilustrator</li>
              <li><span className="text-slate-900">data.released_at / data.added_at</span> — Tanggal rilis terbaru & tanggal masuk (ISO 8601)</li>
              <li><span className="text-slate-900">data.views / data.chapter_count</span> — Jumlah tayangan & total chapter</li>
              <li><span className="text-slate-900">data.chapters[].chapter_slug</span> — ID langsung untuk endpoint reader</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900">Reader & Perpustakaan (`/chapter`, `/berwarna`, `/perpustakaan`)</h3>
            <ul className="space-y-1.5 font-mono text-slate-600">
              <li><span className="text-slate-900">data.pagination</span> — page, limit, total_items, total_pages</li>
              <li><span className="text-slate-900">data.prev_chapter_slug</span> — Slug chapter sebelumnya (atau null)</li>
              <li><span className="text-slate-900">data.next_chapter_slug</span> — Slug chapter berikutnya (atau null)</li>
              <li><span className="text-slate-900">data.pages[].image_url</span> — URL gambar halaman chapter asli</li>
              <li><span className="text-slate-900">data.pages[].proxy_image_url</span> — URL proxy anti-403 siap render</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
