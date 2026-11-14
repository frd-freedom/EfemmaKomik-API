import * as cheerio from 'cheerio';
import fs from 'node:fs';
import path from 'node:path';

export type ComicType = 'Manga' | 'Manhwa' | 'Manhua';
export type ComicStatus = 'Ongoing' | 'Completed' | 'Hiatus';

const KOMIKU_BASE = 'https://komiku.org';
const KOMIKU_API_BASE = 'https://api.komiku.org';
const KOMIKU_ANALYTICS_BASE = 'https://analytics.komiku.org';

const SNAPSHOT_FILE = path.resolve('.data/komiku-snapshot.json');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
];

export interface ComicSummary {
  id: number;
  rank?: number;
  slug: string;
  title: string;
  alternative_title: string;
  type: ComicType;
  country: 'JP' | 'KR' | 'CN';
  language: 'id';
  status: ComicStatus;
  rating: number;
  rating_source?: string;
  age_rating?: string;
  views: number;
  views_label?: string;
  chapter_count: number;
  latest_chapter: string;
  latest_chapter_number: number;
  latest_chapter_slug: string;
  released_at: string;
  updated_at: string;
  updated_label: string;
  cover_url: string;
  proxy_cover_url: string;
  author: string;
  artist: string;
  genres: string[];
  source: string;
  komiku_url: string;
}

export interface ChapterSummary {
  chapter_id: number;
  chapter_slug: string;
  chapter_number: number;
  title: string;
  released_label: string;
  released_at: string;
}

export interface ComicDetail extends ComicSummary {
  synopsis: string;
  theme?: string;
  reading_direction?: string;
  added_at: string;
  chapters: ChapterSummary[];
}

export interface ChapterPage {
  page: number;
  image_url: string;
  proxy_image_url: string;
}

export interface ChapterDetail {
  chapter_slug: string;
  chapter_id: number;
  comic_id: number;
  comic_slug: string;
  comic_title: string;
  chapter_number: number;
  chapter_title: string;
  released_label: string;
  released_at: string;
  prev_chapter_slug: string | null;
  next_chapter_slug: string | null;
  total_pages: number;
  source: string;
  pages: ChapterPage[];
}

export interface KomikuFilters {
  genres: string[];
  types: string[];
  statuses: string[];
}

// Baseline official genres from komiku.org/pustaka/ (refreshed live from komiku.org)
const DEFAULT_KOMIKU_GENRES = [
  'Action',
  'Adaptation',
  'Adult',
  'Adventure',
  'Comedy',
  'Cooking',
  'Crime',
  'Demons',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Game',
  'Gender Bender',
  'Gore',
  'Harem',
  'Historical',
  'Horror',
  'Isekai',
  'Josei',
  'Magic',
  'Martial Arts',
  'Mature',
  'Mecha',
  'Medical',
  'Military',
  'Monster',
  'Murim',
  'Music',
  'Mystery',
  'Overpowered',
  'Psychological',
  'Regression',
  'Reincarnation',
  'Reverse Harem',
  'Romance',
  'School Life',
  'Sci-Fi',
  'Seinen',
  'Shoujo',
  'Shounen',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Survival',
  'System',
  'Thriller',
  'Time Travel',
  'Tragedy',
  'Vampire',
  'Villainess',
];

function hashSlugToId(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i += 1) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 900_000_000 + 100_000;
}

const MARKET_RATING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cleanTitleForMarketLookup(title: string): string {
  return title
    .replace(/^komik\s+/i, '')
    .replace(/\s*(?:\[[^\]]*\]|\([^)]*\))\s*/g, ' ')
    .replace(/\s+(?:bahasa\s+indonesia|sub\s+indo|indo|berwarna|colored|full\s+color)\s*$/i, '')
    .replace(/[:\-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function isReasonableTitleMatch(queryTitle: string, candidateTitles: Array<string | null | undefined>): boolean {
  const qTokens = normalizeTokens(queryTitle);
  if (qTokens.length === 0) return false;
  const qJoined = qTokens.join(' ');

  for (const cand of candidateTitles) {
    if (!cand) continue;
    const cTokens = normalizeTokens(cand);
    if (cTokens.length === 0) continue;
    const cJoined = cTokens.join(' ');
    if (cJoined === qJoined || cJoined.includes(qJoined) || qJoined.includes(cJoined)) {
      return true;
    }
    const cSet = new Set(cTokens);
    const shared = qTokens.filter((t) => cSet.has(t)).length;
    if (shared >= Math.min(2, qTokens.length)) {
      return true;
    }
    if (qTokens.length === 1 && shared === 1) {
      return true;
    }
  }
  return false;
}

interface AniListMediaResult {
  title?: { romaji?: string | null; english?: string | null; native?: string | null };
  synonyms?: string[] | null;
  averageScore?: number | null;
  meanScore?: number | null;
}

async function fetchAniListBatchRatings(titles: string[]): Promise<void> {
  if (titles.length === 0) return;
  const chunks: string[][] = [];
  for (let i = 0; i < titles.length; i += 15) {
    chunks.push(titles.slice(i, i + 15));
  }

  for (const chunk of chunks) {
    const queryBody =
      '{ ' +
      chunk
        .map(
          (title, idx) =>
            `m${idx}: Page(perPage: 3) { media(search: ${JSON.stringify(title)}, type: MANGA, sort: SEARCH_MATCH) { title { romaji english native } synonyms averageScore meanScore } }`
        )
        .join(' ') +
      ' }';

    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        signal: AbortSignal.timeout(5500),
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: queryBody }),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        data?: Record<string, { media?: AniListMediaResult[] } | null>;
      };
      const data = json.data || {};
      const now = Date.now();

      chunk.forEach((rawTitle, idx) => {
        const key = rawTitle.toLowerCase();
        const mediaList = data[`m${idx}`]?.media || [];
        const matched = mediaList.find((media) => {
          const rawScore = media?.averageScore ?? media?.meanScore ?? null;
          if (!rawScore || rawScore <= 0) return false;
          const candidates = [
            media?.title?.english,
            media?.title?.romaji,
            media?.title?.native,
            ...(media?.synonyms || []),
          ];
          return isReasonableTitleMatch(rawTitle, candidates);
        });

        const rawScore = matched?.averageScore ?? matched?.meanScore ?? null;
        if (matched && rawScore && rawScore > 0) {
          const fiveStar = Number(Math.min(5, Math.max(0.5, rawScore / 20)).toFixed(1));
          snapshot.marketRatings[key] = {
            rating: fiveStar,
            source: 'anilist.co',
            savedAt: now,
          };
        } else {
          snapshot.marketRatings[key] = {
            rating: 0,
            source: 'unrated',
            savedAt: now,
          };
        }
      });
      scheduleSnapshotSave();
    } catch {
      // Non-fatal: keep items unrated if AniList temporarily unreachable
    }
  }
}

async function fetchSingleJikanRating(cleanTitle: string): Promise<{ rating: number; source: string } | null> {
  if (!cleanTitle) return null;
  try {
    const res = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(cleanTitle)}&limit=3`, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{
        title?: string;
        title_english?: string | null;
        titles?: Array<{ title?: string }>;
        score?: number | null;
      }>;
    };
    const match = (json.data || []).find((m) => {
      if (!m.score || m.score <= 0) return false;
      const cands = [m.title, m.title_english, ...(m.titles || []).map((t) => t.title)];
      return isReasonableTitleMatch(cleanTitle, cands);
    });
    if (!match || !match.score) return null;
    return {
      rating: Number(Math.min(5, Math.max(0.5, match.score / 2)).toFixed(1)),
      source: 'myanimelist.net',
    };
  } catch {
    return null;
  }
}

async function enrichWithMarketRatings<T extends ComicSummary>(items: T[], allowJikanFallback = false): Promise<T[]> {
  if (items.length === 0) return items;
  const now = Date.now();
  const missingTitles = new Set<string>();

  for (const item of items) {
    const clean = cleanTitleForMarketLookup(item.title);
    if (!clean) continue;
    const cached = snapshot.marketRatings[clean.toLowerCase()];
    if (!cached || now - cached.savedAt > MARKET_RATING_TTL_MS) {
      missingTitles.add(clean);
    }
  }

  if (missingTitles.size > 0) {
    await fetchAniListBatchRatings(Array.from(missingTitles));
  }

  for (const item of items) {
    const clean = cleanTitleForMarketLookup(item.title);
    const key = clean.toLowerCase();
    let cached = snapshot.marketRatings[key];

    if (allowJikanFallback && (!cached || cached.rating === 0)) {
      const altClean = cleanTitleForMarketLookup(item.alternative_title || '');
      const jikan = (await fetchSingleJikanRating(clean)) || (altClean && altClean !== clean ? await fetchSingleJikanRating(altClean) : null);
      if (jikan) {
        cached = { rating: jikan.rating, source: jikan.source, savedAt: Date.now() };
        snapshot.marketRatings[key] = cached;
        scheduleSnapshotSave();
      }
    }

    if (cached && cached.rating > 0) {
      item.rating = cached.rating;
      item.rating_source = cached.source;
    } else {
      item.rating = 0;
      item.rating_source = 'unrated';
    }
  }

  return items;
}

const GENRE_ALIASES: Record<string, string[]> = {
  action: ['action', 'aksi'],
  adventure: ['adventure', 'petualangan'],
  comedy: ['comedy', 'komedi'],
  fantasy: ['fantasy', 'fantasi'],
  romance: ['romance', 'romantis'],
  mystery: ['mystery', 'misteri'],
  horror: ['horror', 'horor'],
  drama: ['drama'],
  isekai: ['isekai'],
  'slice-of-life': ['slice-of-life', 'slice life', 'kehidupan sehari-hari'],
  'school-life': ['school-life', 'school life', 'sekolah'],
  'martial-arts': ['martial-arts', 'martial arts', 'bela diri'],
};

function matchesGenreFilter(itemGenres: string[], filterGenre: string): boolean {
  const target = toGenreSlug(filterGenre);
  if (!target) return true;
  const aliases = GENRE_ALIASES[target] || [target];
  return itemGenres.some((g) => {
    const gs = toGenreSlug(g);
    return gs === target || aliases.some((a) => toGenreSlug(a) === gs);
  });
}

function normalizeType(raw?: string): ComicType {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('manhwa') || lower.includes('/kr.png')) return 'Manhwa';
  if (lower.includes('manhua') || lower.includes('/cn.png')) return 'Manhua';
  return 'Manga';
}

function normalizeStatus(raw?: string): ComicStatus {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('end') || lower.includes('tamat') || lower.includes('completed')) return 'Completed';
  if (lower.includes('hiatus')) return 'Hiatus';
  return 'Ongoing';
}

function detectCountry(type: ComicType): 'JP' | 'KR' | 'CN' {
  if (type === 'Manhwa') return 'KR';
  if (type === 'Manhua') return 'CN';
  return 'JP';
}

function normalizeCoverUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let clean = rawUrl.trim();
  if (clean.startsWith('//')) clean = `https:${clean}`;
  if (clean.startsWith('/')) clean = `${KOMIKU_BASE}${clean}`;
  // Strip lazy placeholder
  if (clean.includes('/asset/img/lazy.jpg')) return '';
  // Rewrite translate.goog image proxy back to real host or thumbnail.komiku.to
  try {
    const u = new URL(clean);
    if (u.hostname === 'thumbnail.komiku.org') {
      u.hostname = 'thumbnail.komiku.to';
      u.searchParams.delete('_x_tr_sl');
      u.searchParams.delete('_x_tr_tl');
      u.searchParams.delete('_x_tr_hl');
      clean = u.toString();
    } else if (u.hostname.endsWith('.translate.goog')) {
      if (u.hostname.startsWith('thumbnail-komiku')) u.hostname = 'thumbnail.komiku.to';
      else if (u.hostname.startsWith('img-komiku-org')) u.hostname = 'img.komiku.org';
      else if (u.hostname.startsWith('komiku-org')) u.hostname = 'komiku.org';
      u.searchParams.delete('_x_tr_sl');
      u.searchParams.delete('_x_tr_tl');
      u.searchParams.delete('_x_tr_hl');
      clean = u.toString();
    }
  } catch {
    // Keep raw clean string
  }
  return clean;
}

function makeProxyImageUrl(rawUrl?: string): string {
  const clean = normalizeCoverUrl(rawUrl);
  if (!clean) return '';
  return `/api/v1/proxy/image?url=${encodeURIComponent(clean)}&ref=${encodeURIComponent(`${KOMIKU_BASE}/`)}`;
}

function extractSlugFromHref(href?: string): string {
  if (!href) return '';
  let target = href.trim();
  try {
    const parsed = new URL(target, KOMIKU_BASE);
    if (parsed.hostname === 'translate.google.com' && parsed.searchParams.get('u')) {
      target = parsed.searchParams.get('u') || target;
    }
  } catch {
    // ignore
  }
  const clean = target.split('?')[0].split('#')[0].replace(/\/+$/, '');
  const parts = clean.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || '';
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

function parseChapterNumber(text?: string): number {
  if (!text) return 0;
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? Number.parseFloat(m[1]) : 0;
}

function parseViewsCount(text?: string): number {
  if (!text) return 0;
  const m = text.match(/([\d.,]+)\s*views?/i);
  if (!m) return 0;
  const digits = m[1].replace(/[.,]/g, '');
  return Number.parseInt(digits, 10) || 0;
}

function parseIndoDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString();
  // Format: DD/MM/YYYY
  const m = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = Number.parseInt(m[1], 10);
    const mo = Number.parseInt(m[2], 10) - 1;
    const y = Number.parseInt(m[3], 10);
    const dt = new Date(Date.UTC(y, mo, d));
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }
  return new Date().toISOString();
}

function estimateIsoFromLabel(label?: string): string {
  if (!label) return new Date().toISOString();
  const lower = label.toLowerCase();
  const n = Number.parseInt(lower.match(/(\d+)/)?.[1] || '0', 10);
  const now = Date.now();
  if (lower.includes('menit')) return new Date(now - n * 60_000).toISOString();
  if (lower.includes('jam')) return new Date(now - n * 3600_000).toISOString();
  if (lower.includes('hari')) return new Date(now - n * 86400_000).toISOString();
  if (lower.includes('minggu')) return new Date(now - n * 7 * 86400_000).toISOString();
  if (lower.includes('bulan')) return new Date(now - n * 30 * 86400_000).toISOString();
  if (lower.includes('tahun')) return new Date(now - n * 365 * 86400_000).toISOString();
  return new Date().toISOString();
}

function toGenreSlug(genre: string): string {
  return genre
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// =========================================================================
// Disk-backed Snapshot + Paced Upstream Fetcher (Resilient vs 403 / 429)
// =========================================================================

interface SnapshotStore {
  htmlCache: Record<string, { html: string; savedAt: number }>;
  titleToSlug: Record<string, string>;
  marketRatings: Record<string, { rating: number; source: string; savedAt: number }>;
}

let snapshot: SnapshotStore = { htmlCache: {}, titleToSlug: {}, marketRatings: {} };
let saveTimer: ReturnType<typeof setTimeout> | null = null;

try {
  if (fs.existsSync(SNAPSHOT_FILE)) {
    const parsed = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8')) as Partial<SnapshotStore>;
    if (parsed && typeof parsed === 'object') {
      snapshot = {
        htmlCache: parsed.htmlCache || {},
        titleToSlug: parsed.titleToSlug || {},
        marketRatings: parsed.marketRatings || {},
      };
    }
  }
} catch {
  // Fresh snapshot
}

function scheduleSnapshotSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const dir = path.dirname(SNAPSHOT_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      // Keep snapshot bounded to 150 freshest pages
      const entries = Object.entries(snapshot.htmlCache)
        .sort((a, b) => b[1].savedAt - a[1].savedAt)
        .slice(0, 150);
      snapshot.htmlCache = Object.fromEntries(entries);
      fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot), 'utf8');
    } catch {
      // Ignore write error
    }
  }, 1500);
}

function rememberSlug(title: string, slug: string): void {
  if (!title || !slug) return;
  snapshot.titleToSlug[title.trim().toLowerCase()] = slug;
}

let directBlockedUntil = 0;
let upstreamQueue: Promise<void> = Promise.resolve();
let lastUpstreamAt = 0;
let uaIndex = 0;

function toTranslateGoogUrl(originalUrl: string): string {
  const u = new URL(originalUrl);
  const translatedHost = `${u.hostname.replace(/\./g, '-')}.translate.goog`;
  u.hostname = translatedHost;
  u.searchParams.set('_x_tr_sl', 'auto');
  u.searchParams.set('_x_tr_tl', 'id');
  u.searchParams.set('_x_tr_hl', 'id');
  return u.toString();
}

function isBlockedHtml(html: string): boolean {
  return (
    html.includes('Attention Required! | Cloudflare') ||
    html.includes('g-recaptcha') ||
    html.includes('/cdn-cgi/challenge-platform')
  );
}

async function enqueuePaced<T>(fn: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const gate = new Promise<void>((res) => {
    release = res;
  });
  const prev = upstreamQueue;
  upstreamQueue = gate;
  await prev;

  try {
    const elapsed = Date.now() - lastUpstreamAt;
    if (elapsed < 950) {
      await new Promise((r) => setTimeout(r, 950 - elapsed));
    }
    const result = await fn();
    lastUpstreamAt = Date.now();
    return result;
  } finally {
    release();
  }
}

async function fetchKomikuHtml(targetUrl: string, maxDiskAgeMs = 15 * 60_000): Promise<string> {
  const cachedSnap = snapshot.htmlCache[targetUrl];
  if (cachedSnap && Date.now() - cachedSnap.savedAt < maxDiskAgeMs) {
    return cachedSnap.html;
  }

  return enqueuePaced(async () => {
    // Re-check disk cache in case another queued item just populated it
    const recheck = snapshot.htmlCache[targetUrl];
    if (recheck && Date.now() - recheck.savedAt < maxDiskAgeMs) {
      return recheck.html;
    }

    const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
    uaIndex += 1;

    // 1. Try direct komiku.org when not recently Cloudflare-blocked (works on VPS / residential)
    if (Date.now() > directBlockedUntil) {
      try {
        const directRes = await fetch(targetUrl, {
          signal: AbortSignal.timeout(7000),
          headers: {
            'User-Agent': ua,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
            Referer: `${KOMIKU_BASE}/`,
          },
        });
        if (directRes.ok) {
          const html = await directRes.text();
          if (!isBlockedHtml(html) && html.length > 500) {
            snapshot.htmlCache[targetUrl] = { html, savedAt: Date.now() };
            scheduleSnapshotSave();
            return html;
          }
        }
        if (directRes.status === 403) {
          directBlockedUntil = Date.now() + 15 * 60_000;
        }
      } catch {
        // Fall through to translate.goog bridge
      }
    }

    // 2. Fallback bridge via translate.goog (bypasses datacenter IP 403 block on Cloud Run)
    const bridgeUrl = toTranslateGoogUrl(targetUrl);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const res = await fetch(bridgeUrl, {
          signal: AbortSignal.timeout(12000),
          headers: {
            'User-Agent': USER_AGENTS[(uaIndex + attempt) % USER_AGENTS.length],
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
          },
        });

        if (res.status === 404) {
          throw new Error(`NOT_FOUND:${targetUrl}`);
        }

        const html = await res.text();
        if (res.ok && !isBlockedHtml(html) && html.length > 400) {
          snapshot.htmlCache[targetUrl] = { html, savedAt: Date.now() };
          scheduleSnapshotSave();
          return html;
        }

        // Wait briefly on 429/captcha before single retry
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 2200));
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('NOT_FOUND:')) {
          throw err;
        }
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    // 3. Stale-safe fallback from disk snapshot if upstream temporarily rate-limited
    if (cachedSnap && cachedSnap.html.length > 400) {
      return cachedSnap.html;
    }

    throw new Error(`Komiku upstream sementara sibuk saat memuat ${targetUrl}`);
  });
}

// =========================================================================
// HTML Parsers for Komiku.org & Api.komiku.org
// =========================================================================

function parseLs2Section(
  $: cheerio.CheerioAPI,
  containerSelector: string,
  extraGenre?: string
): ComicSummary[] {
  const results: ComicSummary[] = [];
  $(`${containerSelector} .ls2`).each((_, el) => {
    const $el = $(el);
    const titleAnchor = $el.find('.ls2j h3 a').first();
    const title = titleAnchor.text().trim();
    const slug = extractSlugFromHref(titleAnchor.attr('href'));
    if (!title || !slug) return;

    rememberSlug(title, slug);

    const flagSrc = $el.find('img.flag').attr('src') || '';
    const imgAlt = $el.find('img').first().attr('alt') || '';
    const type = normalizeType(`${flagSrc} ${imgAlt}`);

    const ls2t = $el.find('.ls2t').text().trim();
    const [genrePart, timePart] = ls2t.split('·').map((s) => s.trim());
    const updatedLabel = timePart || ls2t || 'Baru saja';

    const chAnchor = $el.find('.ls2j a.ls2l').first();
    const latestChapter = chAnchor.text().trim() || 'Chapter 1';
    const latestChSlug = extractSlugFromHref(chAnchor.attr('href'));
    const chNum = parseChapterNumber(latestChapter);

    const rawImg = $el.find('.ls2v img').first().attr('data-src') || $el.find('.ls2v img').first().attr('src') || '';
    const coverUrl = normalizeCoverUrl(rawImg);

    const genres: string[] = [];
    if (genrePart) genres.push(genrePart);
    if (extraGenre && !genres.some((g) => toGenreSlug(g) === toGenreSlug(extraGenre))) {
      genres.push(extraGenre);
    }

    results.push({
      id: hashSlugToId(slug),
      slug,
      title,
      alternative_title: title,
      type,
      country: detectCountry(type),
      language: 'id',
      status: 'Ongoing',
      rating: 0,
      rating_source: 'unrated',
      views: 0,
      chapter_count: Math.max(1, Math.floor(chNum)),
      latest_chapter: latestChapter,
      latest_chapter_number: chNum,
      latest_chapter_slug: latestChSlug,
      released_at: estimateIsoFromLabel(updatedLabel),
      updated_at: estimateIsoFromLabel(updatedLabel),
      updated_label: updatedLabel,
      cover_url: coverUrl,
      proxy_cover_url: makeProxyImageUrl(coverUrl),
      author: 'Komiku.org',
      artist: 'Komiku.org',
      genres,
      source: 'komiku.org',
      komiku_url: `${KOMIKU_BASE}/manga/${encodeURIComponent(slug)}/`,
    });
  });
  return results;
}

function parseLs4Section($: cheerio.CheerioAPI, containerSelector: string): ComicSummary[] {
  const results: ComicSummary[] = [];
  $(`${containerSelector} .ls4`).each((idx, el) => {
    const $el = $(el);
    const titleAnchor = $el.find('.ls4j h4 a').first();
    const title = titleAnchor.text().trim();
    const slug = extractSlugFromHref(titleAnchor.attr('href'));
    if (!title || !slug) return;

    rememberSlug(title, slug);

    const rankNum = Number.parseInt($el.find('.rank-num').text().trim(), 10) || idx + 1;
    const ls4s = $el.find('.ls4s').text().trim();
    const [genrePart, viewsPart] = ls4s.split('·').map((s) => s.trim());
    const views = parseViewsCount(viewsPart || ls4s);

    const chAnchor = $el.find('.ls4j a.ls24').first();
    const latestChapter = chAnchor.text().trim() || 'Chapter 1';
    const latestChSlug = extractSlugFromHref(chAnchor.attr('href'));
    const chNum = parseChapterNumber(latestChapter);

    const rawImg = $el.find('.ls4v img').first().attr('data-src') || $el.find('.ls4v img').first().attr('src') || '';
    const coverUrl = normalizeCoverUrl(rawImg);

    const imgAlt = $el.find('.ls4v img').first().attr('alt') || '';
    const type = normalizeType(imgAlt);

    results.push({
      id: hashSlugToId(slug),
      rank: rankNum,
      slug,
      title,
      alternative_title: title,
      type,
      country: detectCountry(type),
      language: 'id',
      status: 'Ongoing',
      rating: 0,
      rating_source: 'unrated',
      views,
      views_label: viewsPart || `${views.toLocaleString('en-US')} views`,
      chapter_count: Math.max(1, Math.floor(chNum)),
      latest_chapter: latestChapter,
      latest_chapter_number: chNum,
      latest_chapter_slug: latestChSlug,
      released_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_label: viewsPart || `#${rankNum} Komiku`,
      cover_url: coverUrl,
      proxy_cover_url: makeProxyImageUrl(coverUrl),
      author: 'Komiku.org',
      artist: 'Komiku.org',
      genres: genrePart ? [genrePart] : [],
      source: 'komiku.org',
      komiku_url: `${KOMIKU_BASE}/manga/${encodeURIComponent(slug)}/`,
    });
  });
  return results;
}

function parseApiBgeList($: cheerio.CheerioAPI): { items: ComicSummary[]; hasNext: boolean } {
  const items: ComicSummary[] = [];
  $('.bge').each((_, el) => {
    const $el = $(el);
    const titleAnchor = $el.find('.kan a').first();
    const title = $el.find('.kan h3').first().text().trim() || titleAnchor.text().trim();
    const slug = extractSlugFromHref(titleAnchor.attr('href') || $el.find('.bgei a').first().attr('href'));
    if (!title || !slug) return;

    rememberSlug(title, slug);

    const typeText = $el.find('.tpe1_inf b').text().trim();
    const genreFromBadge = $el.find('.tpe1_inf').text().replace(typeText, '').trim();
    const type = normalizeType(typeText);

    const judul2 = $el.find('.judul2').text().trim();
    let parsedGenre = genreFromBadge;
    let updatedLabel = 'Terbaru';
    const extraTags: string[] = [];

    if (judul2.includes('|')) {
      const j2Parts = judul2.split('|').map((s) => s.trim()).filter(Boolean);
      const firstPart = j2Parts[0] || '';
      if (!/pembaca|views/i.test(firstPart) && firstPart) {
        parsedGenre = firstPart.replace(/\s+x$/i, '').trim();
      }
      if (j2Parts[1]) {
        updatedLabel = j2Parts[1];
      }
    } else if (judul2.includes('•') || judul2.includes('·')) {
      const bulletParts = judul2.split(/[•·]/).map((s) => s.trim()).filter(Boolean);
      if (bulletParts[0] && !/pembaca|views/i.test(bulletParts[0])) {
        parsedGenre = bulletParts[0].replace(/\s+x$/i, '').trim();
      }
      if (bulletParts[1]) {
        updatedLabel = bulletParts[1];
      }
      if (bulletParts.some((p) => /berwarna/i.test(p))) {
        extraTags.push('Berwarna');
      }
    } else if (judul2) {
      parsedGenre = genreFromBadge || judul2.replace(/\s+x$/i, '').trim();
    }

    const cleanGenres = [parsedGenre, ...extraTags].filter(
      (g, i, arr) => Boolean(g) && arr.indexOf(g) === i
    );

    const latestLink = $el.find('.kan .new1 a').last();
    const latestChapter = latestLink.find('span').last().text().trim() || latestLink.text().trim() || 'Chapter 1';
    const latestChSlug = extractSlugFromHref(latestLink.attr('href'));
    const chNum = parseChapterNumber(latestChapter);

    const rawImg = $el.find('.bgei img').first().attr('data-src') || $el.find('.bgei img').first().attr('src') || '';
    const coverUrl = normalizeCoverUrl(rawImg);

    items.push({
      id: hashSlugToId(slug),
      slug,
      title,
      alternative_title: title,
      type,
      country: detectCountry(type),
      language: 'id',
      status: 'Ongoing',
      rating: 0,
      rating_source: 'unrated',
      views: 0,
      chapter_count: Math.max(1, Math.floor(chNum)),
      latest_chapter: latestChapter,
      latest_chapter_number: chNum,
      latest_chapter_slug: latestChSlug,
      released_at: estimateIsoFromLabel(updatedLabel),
      updated_at: estimateIsoFromLabel(updatedLabel),
      updated_label: updatedLabel,
      cover_url: coverUrl,
      proxy_cover_url: makeProxyImageUrl(coverUrl),
      author: 'Komiku.org',
      artist: 'Komiku.org',
      genres: cleanGenres,
      source: 'komiku.org',
      komiku_url: `${KOMIKU_BASE}/manga/${encodeURIComponent(slug)}/`,
    });
  });

  const hasNext = $('[hx-get]').length > 0;
  return { items, hasNext };
}

function parseDaftarKomik($: cheerio.CheerioAPI): { items: ComicSummary[]; totalPages: number } {
  const items: ComicSummary[] = [];
  $('.manga-card').each((_, el) => {
    const $el = $(el);
    const titleAnchor = $el.find('h4 a').first();
    const title = titleAnchor.text().trim();
    const slug = extractSlugFromHref(titleAnchor.attr('href') || $el.find('a').first().attr('href'));
    if (!title || !slug) return;

    rememberSlug(title, slug);

    const metaText = $el.find('.meta').text().replace(/\s+/g, ' ').trim();
    const type = normalizeType(metaText);
    const status = normalizeStatus(metaText);
    const genreMatch = metaText.match(/•\s*([^S]+?)(?:Status:|$)/i);
    const primaryGenre = genreMatch ? genreMatch[1].trim() : '';

    const rawImg = $el.find('img').first().attr('data-src') || $el.find('img').first().attr('src') || '';
    const coverUrl = normalizeCoverUrl(rawImg);

    items.push({
      id: hashSlugToId(slug),
      slug,
      title,
      alternative_title: title,
      type,
      country: detectCountry(type),
      language: 'id',
      status,
      rating: 0,
      rating_source: 'unrated',
      views: 0,
      chapter_count: 1,
      latest_chapter: status,
      latest_chapter_number: 1,
      latest_chapter_slug: `${slug}-chapter-1`,
      released_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_label: status,
      cover_url: coverUrl,
      proxy_cover_url: makeProxyImageUrl(coverUrl),
      author: 'Komiku.org',
      artist: 'Komiku.org',
      genres: primaryGenre ? [primaryGenre] : [],
      source: 'komiku.org',
      komiku_url: `${KOMIKU_BASE}/manga/${encodeURIComponent(slug)}/`,
    });
  });

  let totalPages = 162;
  $('.pagination a').each((_, a) => {
    const n = Number.parseInt($(a).text().trim(), 10);
    if (!Number.isNaN(n) && n > totalPages) totalPages = n;
  });

  return { items, totalPages };
}

// =========================================================================
// Public Service Functions
// =========================================================================

export async function getKomikuFilters(): Promise<KomikuFilters> {
  try {
    const html = await fetchKomikuHtml(`${KOMIKU_BASE}/pustaka/`, 6 * 3600_000);
    const $ = cheerio.load(html);
    const genres: string[] = [];
    $('select[name="genre"] option').each((_, opt) => {
      const val = $(opt).attr('value') || '';
      const label = $(opt).text().trim();
      if (!val || label.includes('(0)')) return;
      const cleanName = label.replace(/\s*\([\d.,]+\)\s*$/, '').trim();
      if (cleanName) genres.push(cleanName);
    });
    if (genres.length > 20) {
      return {
        genres,
        types: ['Manga', 'Manhwa', 'Manhua'],
        statuses: ['Semua', 'Ongoing', 'Completed'],
      };
    }
  } catch {
    // Fallback to seeded official Komiku.org genres
  }

  return {
    genres: DEFAULT_KOMIKU_GENRES,
    types: ['Manga', 'Manhwa', 'Manhua'],
    statuses: ['Semua', 'Ongoing', 'Completed'],
  };
}

export async function getKomikuCatalog(options: {
  category: 'terupdate' | 'terpopuler' | 'trending' | 'rekomendasi' | 'berwarna' | 'perpustakaan' | 'all';
  type?: string;
  genre?: string;
  status?: string;
  sort?: string;
  period?: string;
  q?: string;
  page?: number;
  limit?: number;
}): Promise<{
  items: ComicSummary[];
  pagination: { page: number; limit: number; total_items: number; total_pages: number };
  upstream_source: string;
}> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 24));
  const cleanType =
    options.type && !['all', 'semua'].includes(options.type.toLowerCase())
      ? normalizeType(options.type)
      : '';
  const cleanGenre =
    options.genre && !['all', 'semua'].includes(options.genre.toLowerCase()) ? options.genre.trim() : '';
  const cleanStatus =
    options.status && !['all', 'semua'].includes(options.status.toLowerCase())
      ? options.status.trim()
      : '';
  const cleanQuery = (options.q || '').trim();

  // 1. Search across ALL Komiku.org comics via api.komiku.org/manga/?s=...
  if (cleanQuery.length > 0 && options.category !== 'berwarna') {
    const params = new URLSearchParams();
    params.set('s', cleanQuery);
    if (cleanType) params.set('tipe', cleanType.toLowerCase());
    if (cleanGenre) params.set('genre', toGenreSlug(cleanGenre));
    const url =
      page > 1
        ? `${KOMIKU_API_BASE}/manga/page/${page}/?${params.toString()}`
        : `${KOMIKU_API_BASE}/manga/?${params.toString()}`;

    const html = await fetchKomikuHtml(url, 300_000);
    const $ = cheerio.load(html);
    const { items, hasNext } = parseApiBgeList($);
    const sliced = await enrichWithMarketRatings(items.slice(0, limit));
    return {
      items: sliced,
      pagination: {
        page,
        limit,
        total_items: hasNext ? page * 10 + 10 : (page - 1) * 10 + items.length,
        total_pages: hasNext ? page + 1 : page,
      },
      upstream_source: 'komiku.org',
    };
  }

  // 2. Unfiltered Terupdate -> Komiku.org Homepage #Terbaru (40 items) on Page 1
  if (options.category === 'terupdate' && !cleanType && !cleanGenre && !cleanStatus && page === 1) {
    const html = await fetchKomikuHtml(`${KOMIKU_BASE}/`, 180_000);
    const $ = cheerio.load(html);
    const items = await enrichWithMarketRatings(parseLs2Section($, '#Terbaru').slice(0, limit));
    return {
      items,
      pagination: { page: 1, limit, total_items: 8100, total_pages: 200 },
      upstream_source: 'komiku.org',
    };
  }

  // 3. Rekomendasi (supports Type & Genre without falling back to Terupdate!)
  if (options.category === 'rekomendasi') {
    const html = await fetchKomikuHtml(`${KOMIKU_BASE}/`, 300_000);
    const $ = cheerio.load(html);

    const pool: ComicSummary[] = [];
    const seen = new Set<string>();
    const addUnique = (list: ComicSummary[]) => {
      for (const item of list) {
        if (!seen.has(item.slug)) {
          seen.add(item.slug);
          pool.push(item);
        }
      }
    };

    addUnique(parseLs4Section($, '#Rekomendasi_Komik #rank-harian'));
    addUnique(parseLs2Section($, '#Baru_Ditambahkan'));
    $('.lsgenre').each((_, sec) => {
      const heading = $(sec).find('h2').first().text().replace(/^Komik\s+/i, '').trim();
      $(sec)
        .find('.ls2')
        .each((__, card) => {
          const titleAnchor = $(card).find('.ls2j h3 a').first();
          const title = titleAnchor.text().trim();
          const slug = extractSlugFromHref(titleAnchor.attr('href'));
          if (!title || !slug || seen.has(slug)) return;
          seen.add(slug);
          rememberSlug(title, slug);

          const flagSrc = $(card).find('img.flag').attr('src') || '';
          const imgAlt = $(card).find('img').first().attr('alt') || '';
          const type = normalizeType(`${flagSrc} ${imgAlt}`);
          const ls2t = $(card).find('.ls2t').text().trim();
          const [genrePart, timePart] = ls2t.split('·').map((s) => s.trim());
          const updatedLabel = timePart || ls2t || 'Rekomendasi';
          const chAnchor = $(card).find('.ls2j a.ls2l').first();
          const latestChapter = chAnchor.text().trim() || 'Chapter 1';
          const latestChSlug = extractSlugFromHref(chAnchor.attr('href'));
          const chNum = parseChapterNumber(latestChapter);
          const rawImg =
            $(card).find('.ls2v img').first().attr('data-src') || $(card).find('.ls2v img').first().attr('src') || '';
          const coverUrl = normalizeCoverUrl(rawImg);

          const genres = [heading, genrePart].filter((g, i, arr) => Boolean(g) && arr.indexOf(g) === i);
          pool.push({
            id: hashSlugToId(slug),
            slug,
            title,
            alternative_title: title,
            type,
            country: detectCountry(type),
            language: 'id',
            status: 'Ongoing',
            rating: 0,
            rating_source: 'unrated',
            views: 0,
            chapter_count: Math.max(1, Math.floor(chNum)),
            latest_chapter: latestChapter,
            latest_chapter_number: chNum,
            latest_chapter_slug: latestChSlug,
            released_at: estimateIsoFromLabel(updatedLabel),
            updated_at: estimateIsoFromLabel(updatedLabel),
            updated_label: updatedLabel,
            cover_url: coverUrl,
            proxy_cover_url: makeProxyImageUrl(coverUrl),
            author: 'Komiku.org',
            artist: 'Komiku.org',
            genres,
            source: 'komiku.org',
            komiku_url: `${KOMIKU_BASE}/manga/${encodeURIComponent(slug)}/`,
          });
        });
    });

    const filteredPool = pool.filter((item) => {
      if (cleanType && item.type !== cleanType) return false;
      if (cleanGenre && !matchesGenreFilter(item.genres, cleanGenre)) return false;
      return true;
    });

    // If niche genre/type yields too few from homepage curated sections, fetch Komiku's orderby=date (Baru Ditambahkan / Rekomendasi)
    if (filteredPool.length < 4 && (cleanType || cleanGenre)) {
      const params = new URLSearchParams();
      params.set('orderby', 'date');
      if (cleanType) params.set('tipe', cleanType.toLowerCase());
      if (cleanGenre) params.set('genre', toGenreSlug(cleanGenre));
      const apiUrl =
        page > 1
          ? `${KOMIKU_API_BASE}/manga/page/${page}/?${params.toString()}`
          : `${KOMIKU_API_BASE}/manga/?${params.toString()}`;
      const apiHtml = await fetchKomikuHtml(apiUrl, 300_000);
      const $api = cheerio.load(apiHtml);
      const { items, hasNext } = parseApiBgeList($api);
      return {
        items: await enrichWithMarketRatings(items.slice(0, limit)),
        pagination: {
          page,
          limit,
          total_items: hasNext ? page * 10 + 10 : items.length,
          total_pages: hasNext ? page + 1 : page,
        },
        upstream_source: 'komiku.org',
      };
    }

    const start = (page - 1) * limit;
    return {
      items: await enrichWithMarketRatings(filteredPool.slice(start, start + limit)),
      pagination: {
        page,
        limit,
        total_items: filteredPool.length,
        total_pages: Math.max(1, Math.ceil(filteredPool.length / limit)),
      },
      upstream_source: 'komiku.org',
    };
  }

  // 4. Terpopuler (Peringkat Komiku Harian/Mingguan/Bulanan/Total, or filtered by Type/Genre via orderby=meta_value_num)
  if (options.category === 'terpopuler') {
    if (cleanType || cleanGenre || cleanStatus) {
      const params = new URLSearchParams();
      params.set('orderby', 'meta_value_num');
      if (cleanType) params.set('tipe', cleanType.toLowerCase());
      if (cleanGenre) params.set('genre', toGenreSlug(cleanGenre));
      if (cleanStatus) {
        params.set('status', cleanStatus.toLowerCase() === 'completed' ? 'end' : cleanStatus.toLowerCase());
      }
      const apiUrl =
        page > 1
          ? `${KOMIKU_API_BASE}/manga/page/${page}/?${params.toString()}`
          : `${KOMIKU_API_BASE}/manga/?${params.toString()}`;
      const html = await fetchKomikuHtml(apiUrl, 600_000);
      const $ = cheerio.load(html);
      const { items, hasNext } = parseApiBgeList($);
      return {
        items: await enrichWithMarketRatings(items.slice(0, limit)),
        pagination: {
          page,
          limit,
          total_items: hasNext ? page * 10 + 10 : items.length,
          total_pages: hasNext ? page + 1 : page,
        },
        upstream_source: 'komiku.org',
      };
    }

    const html = await fetchKomikuHtml(`${KOMIKU_BASE}/p/ranking/`, 600_000);
    const $ = cheerio.load(html);
    const period = (options.period || 'harian').toLowerCase();
    const tabId =
      period === 'mingguan'
        ? '#rank-mingguan'
        : period === 'bulanan'
          ? '#rank-bulanan'
          : period === 'total' || period === 'all'
            ? '#rank-total'
            : '#rank-harian';

    const allRanked = parseLs4Section($, tabId);
    const start = (page - 1) * limit;
    const paged = await enrichWithMarketRatings(allRanked.slice(start, start + limit));

    return {
      items: paged,
      pagination: {
        page,
        limit,
        total_items: allRanked.length,
        total_pages: Math.max(1, Math.ceil(allRanked.length / limit)),
      },
      upstream_source: 'komiku.org',
    };
  }

  // 5. Trending (Realtime Active Readers from analytics.komiku.org JSON API — natively supports type & genre!)
  if (options.category === 'trending') {
    if (Object.keys(snapshot.titleToSlug).length < 20) {
      await fetchKomikuHtml(`${KOMIKU_BASE}/p/ranking/`, 600_000)
        .then((rkHtml) => {
          const $rk = cheerio.load(rkHtml);
          parseLs4Section($rk, '#rank-harian');
        })
        .catch(() => {});
    }

    const trParams = new URLSearchParams();
    trParams.set('format', 'json');
    trParams.set('limit', '100');
    if (cleanType) trParams.set('type', cleanType.toLowerCase());

    const rawJsonText = await fetchKomikuHtml(
      `${KOMIKU_ANALYTICS_BASE}/api/popular/active/?${trParams.toString()}`,
      180_000
    );

    const parsedJson = JSON.parse(rawJsonText) as {
      total?: number;
      items?: Array<{
        rank?: number;
        idSeries?: number;
        title: string;
        type?: string;
        genres?: string[];
        publicationStatus?: string;
        ageRating?: number;
        thumbnail?: string;
        activeUsers?: number;
        views?: { daily?: number; weekly?: number; monthly?: number; total?: number };
      }>;
    };

    const rawItems = parsedJson.items || [];
    const filtered = rawItems.filter((it) => {
      if (cleanType && normalizeType(it.type) !== cleanType) return false;
      if (cleanGenre && !matchesGenreFilter(it.genres || [], cleanGenre)) return false;
      if (cleanStatus && normalizeStatus(it.publicationStatus) !== normalizeStatus(cleanStatus)) return false;
      return true;
    });

    const mapped: ComicSummary[] = filtered.map((it, idx) => {
      const coverUrl = normalizeCoverUrl(it.thumbnail);
      const uploadMatch = coverUrl.match(/\/uploads\/manga\/([^/]+)\//i);
      const slug =
        uploadMatch?.[1] ||
        snapshot.titleToSlug[it.title.toLowerCase()] ||
        it.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

      const type = normalizeType(it.type);
      const activeUsers = it.activeUsers ?? 0;
      const dailyViews = it.views?.daily ?? 0;
      const rank = idx + 1;

      return {
        id: it.idSeries || hashSlugToId(slug),
        rank,
        slug,
        title: it.title,
        alternative_title: it.title,
        type,
        country: detectCountry(type),
        language: 'id',
        status: normalizeStatus(it.publicationStatus),
        rating: 0,
        rating_source: 'unrated',
        age_rating: it.ageRating && it.ageRating > 0 ? `${it.ageRating}+` : '13+',
        views: dailyViews || activeUsers,
        views_label: `${activeUsers} pembaca aktif · ${dailyViews.toLocaleString('id-ID')} views`,
        chapter_count: 1,
        latest_chapter: `${activeUsers} online`,
        latest_chapter_number: 1,
        latest_chapter_slug: slug,
        released_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_label: `${activeUsers} online`,
        cover_url: coverUrl,
        proxy_cover_url: makeProxyImageUrl(coverUrl),
        author: 'Komiku.org',
        artist: 'Komiku.org',
        genres: Array.isArray(it.genres) ? it.genres.map((g) => g.replace(/\b\w/g, (c) => c.toUpperCase())) : [],
        source: 'komiku.org',
        komiku_url: `${KOMIKU_BASE}/manga/${encodeURIComponent(slug)}/`,
      };
    });

    const start = (page - 1) * limit;
    return {
      items: await enrichWithMarketRatings(mapped.slice(start, start + limit)),
      pagination: {
        page,
        limit,
        total_items: mapped.length,
        total_pages: Math.max(1, Math.ceil(mapped.length / limit)),
      },
      upstream_source: 'komiku.org',
    };
  }

  // 6. Komik Berwarna (/other/berwarna/) with pagination & optional type/genre/query filter
  if (options.category === 'berwarna') {
    const bwUrl =
      page > 1 ? `${KOMIKU_API_BASE}/other/berwarna/page/${page}/` : `${KOMIKU_API_BASE}/other/berwarna/`;
    const html = await fetchKomikuHtml(bwUrl, 300_000);
    const $ = cheerio.load(html);
    const { items, hasNext } = parseApiBgeList($);

    const filtered = items.filter((item) => {
      if (cleanType && item.type !== cleanType) return false;
      if (cleanGenre && !matchesGenreFilter(item.genres, cleanGenre)) return false;
      if (cleanQuery && !item.title.toLowerCase().includes(cleanQuery.toLowerCase())) return false;
      return true;
    });

    const totalPages = hasNext ? Math.max(page + 1, 250) : page;
    return {
      items: await enrichWithMarketRatings(filtered.slice(0, limit)),
      pagination: {
        page,
        limit,
        total_items: totalPages * 10,
        total_pages: totalPages,
      },
      upstream_source: 'komiku.org',
    };
  }

  // 7. Unfiltered Perpustakaan (Daftar Komik Komiku.org: 50 judul/halaman, 162 halaman)
  if (
    options.category === 'perpustakaan' &&
    !cleanType &&
    !cleanGenre &&
    !cleanStatus &&
    (!options.sort || options.sort === 'latest') &&
    limit > 10
  ) {
    const dkUrl = page > 1 ? `${KOMIKU_BASE}/daftar-komik/?halaman=${page}` : `${KOMIKU_BASE}/daftar-komik/`;
    const html = await fetchKomikuHtml(dkUrl, 900_000);
    const $ = cheerio.load(html);
    const { items, totalPages } = parseDaftarKomik($);
    if (items.length > 0) {
      return {
        items: await enrichWithMarketRatings(items.slice(0, limit)),
        pagination: {
          page,
          limit,
          total_items: totalPages * 50,
          total_pages: totalPages,
        },
        upstream_source: 'komiku.org',
      };
    }
  }

  // 8. Filtered / Paginated Komiku Catalog (Terupdate, By Type, By Genre, By Status, Sort)
  const params = new URLSearchParams();
  if (options.sort === 'popular') {
    params.set('orderby', 'meta_value_num');
  } else if (options.sort === 'rating') {
    params.set('orderby', 'meta_value_num');
  } else if (options.sort === 'newest') {
    params.set('orderby', 'date');
  } else {
    params.set('orderby', 'modified');
  }

  if (cleanType) params.set('tipe', cleanType.toLowerCase());
  if (cleanGenre) params.set('genre', toGenreSlug(cleanGenre));
  if (cleanStatus) {
    params.set('status', cleanStatus.toLowerCase() === 'completed' ? 'end' : cleanStatus.toLowerCase());
  }

  const apiUrl =
    page > 1
      ? `${KOMIKU_API_BASE}/manga/page/${page}/?${params.toString()}`
      : `${KOMIKU_API_BASE}/manga/?${params.toString()}`;

  const html = await fetchKomikuHtml(apiUrl, 300_000);
  const $ = cheerio.load(html);
  const { items, hasNext } = parseApiBgeList($);
  const totalPages = hasNext ? Math.max(page + 1, !cleanType && !cleanGenre && !cleanStatus ? 800 : page + 5) : page;

  return {
    items: await enrichWithMarketRatings(items.slice(0, limit)),
    pagination: {
      page,
      limit,
      total_items: totalPages * 10,
      total_pages: totalPages,
    },
    upstream_source: 'komiku.org',
  };
}

export async function getKomikuDetail(slug: string): Promise<ComicDetail | null> {
  const cleanSlug = decodeURIComponent(slug).replace(/^\/+|\/+$/g, '');
  let html = '';
  let resolvedSlug = cleanSlug;

  try {
    html = await fetchKomikuHtml(`${KOMIKU_BASE}/manga/${encodeURIComponent(cleanSlug)}/`, 900_000);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NOT_FOUND:')) {
      // Fallback: resolve title slug via api.komiku.org search (helpful for trending slugs)
      try {
        const searchHtml = await fetchKomikuHtml(
          `${KOMIKU_API_BASE}/manga/?s=${encodeURIComponent(cleanSlug.replace(/-/g, ' '))}`,
          300_000
        );
        const $s = cheerio.load(searchHtml);
        const { items } = parseApiBgeList($s);
        if (items[0]?.slug && items[0].slug !== cleanSlug) {
          resolvedSlug = items[0].slug;
          html = await fetchKomikuHtml(`${KOMIKU_BASE}/manga/${encodeURIComponent(resolvedSlug)}/`, 900_000);
        } else {
          return null;
        }
      } catch {
        return null;
      }
    } else {
      throw err;
    }
  }

  const $ = cheerio.load(html);
  const infoMap: Record<string, string> = {};
  $('.inftable tr').each((_, tr) => {
    const cells = $(tr).find('td');
    if (cells.length >= 2) {
      const key = cells.eq(0).text().replace(':', '').trim().toLowerCase();
      const val = cells.eq(1).text().trim();
      if (key) infoMap[key] = val;
    }
  });

  const title = infoMap['judul'] || infoMap['judul komik'] || $('#Judul h1').text().replace(/^Komik\s+/i, '').trim();
  if (!title) return null;

  rememberSlug(title, resolvedSlug);

  const genres: string[] = [];
  $('.genre li a, .genre li').each((_, el) => {
    const g = $(el).text().trim();
    if (g && !genres.includes(g)) genres.push(g);
  });

  const chapters: ChapterSummary[] = [];
  $('#Daftar_Chapter tbody tr').each((_, tr) => {
    const a = $(tr).find('td.judulseries a').first();
    if (!a.length) return;
    const chTitle = a.text().trim();
    const chSlug = extractSlugFromHref(a.attr('href'));
    const chNum = parseChapterNumber(chTitle);
    const releasedLabel = $(tr).find('td.tanggalseries').text().trim() || '-';
    if (!chSlug) return;
    chapters.push({
      chapter_id: hashSlugToId(chSlug),
      chapter_slug: chSlug,
      chapter_number: chNum,
      title: chTitle || `Chapter ${chNum}`,
      released_label: releasedLabel,
      released_at: parseIndoDate(releasedLabel),
    });
  });

  const type = normalizeType(infoMap['tipe'] || infoMap['jenis komik']);
  const status = normalizeStatus(infoMap['status']);
  const ageRating = infoMap['rating'] || infoMap['usia'] || '13+';

  const rawCover = $('.ims img').first().attr('src') || $('.ims img').first().attr('data-src') || '';
  const coverUrl = normalizeCoverUrl(rawCover);
  const synopsis = $('.desc').text().trim() || $('#Sinopsis p').text().trim() || 'Sinopsis bahasa Indonesia tersedia di Komiku.org.';

  const latestCh = chapters[0];
  const oldestCh = chapters[chapters.length - 1];

  const detailObj: ComicDetail = {
    id: hashSlugToId(resolvedSlug),
    slug: resolvedSlug,
    title,
    alternative_title: infoMap['judul alternatif'] || title,
    type,
    country: detectCountry(type),
    language: 'id',
    status,
    rating: 0,
    rating_source: 'unrated',
    age_rating: ageRating,
    views: 0,
    chapter_count: chapters.length,
    latest_chapter: latestCh?.title || 'Chapter 1',
    latest_chapter_number: latestCh?.chapter_number ?? 1,
    latest_chapter_slug: latestCh?.chapter_slug || `${resolvedSlug}-chapter-1`,
    released_at: latestCh?.released_at || new Date().toISOString(),
    updated_at: latestCh?.released_at || new Date().toISOString(),
    updated_label: latestCh?.released_label || '-',
    cover_url: coverUrl,
    proxy_cover_url: makeProxyImageUrl(coverUrl),
    author: infoMap['author'] || infoMap['pengarang'] || 'Anonim',
    artist: infoMap['author'] || infoMap['ilustrator'] || 'Anonim',
    genres,
    theme: infoMap['tema'] || '',
    reading_direction: infoMap['cara baca'] || 'Kanan ke kiri',
    synopsis,
    added_at: oldestCh?.released_at || latestCh?.released_at || new Date().toISOString(),
    chapters,
    source: 'komiku.org',
    komiku_url: `${KOMIKU_BASE}/manga/${encodeURIComponent(resolvedSlug)}/`,
  };

  await enrichWithMarketRatings([detailObj], true);
  return detailObj;
}

export async function getKomikuChapter(chapterKey: string): Promise<ChapterDetail | null> {
  let cleanChapterSlug = decodeURIComponent(chapterKey).replace(/^\/+|\/+$/g, '');

  // Backward compatibility if called with "<slug>__<id>" or "-ch-" pattern
  if (cleanChapterSlug.includes('__')) {
    cleanChapterSlug = cleanChapterSlug.split('__')[0];
  }

  let html: string;
  try {
    html = await fetchKomikuHtml(`${KOMIKU_BASE}/${encodeURIComponent(cleanChapterSlug)}/`, 1_800_000);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('NOT_FOUND:')) {
      // Try resolving via detail chapters if caller passed "<comicSlug>-ch-<num>"
      const m = cleanChapterSlug.match(/^(.*?)-(?:ch|chapter)-([\d.-]+)$/i);
      if (m) {
        const detail = await getKomikuDetail(m[1]);
        const targetNum = Number.parseFloat(m[2].replace('-', '.'));
        const matched = detail?.chapters.find((c) => Math.abs(c.chapter_number - targetNum) < 0.01);
        if (matched && matched.chapter_slug !== cleanChapterSlug) {
          return getKomikuChapter(matched.chapter_slug);
        }
      }
      return null;
    }
    throw err;
  }

  const $ = cheerio.load(html);
  const h1Text = $('#Judul h1').first().text().trim() || $('h1').first().text().trim();
  const chapterNum = parseChapterNumber(h1Text) || parseChapterNumber(cleanChapterSlug);

  let prevSlug: string | null = null;
  let nextSlug: string | null = null;
  let comicSlug = '';
  let comicTitle = h1Text.replace(/\s*Chapter\s*[\d.]+.*$/i, '').trim() || 'Komik';

  $('.nxpr a').each((_, a) => {
    const href = $(a).attr('href') || '';
    const title = $(a).attr('title') || $(a).text().trim();
    const s = extractSlugFromHref(href);
    if (!s) return;

    if (href.includes('/manga/')) {
      comicSlug = s;
      if (title) comicTitle = title.replace(/^Daftar Chapter\s*/i, '').trim();
    } else {
      const linkNum = parseChapterNumber(title || s);
      if (linkNum > 0 && linkNum < chapterNum && !prevSlug) {
        prevSlug = s;
      } else if (linkNum > chapterNum && !nextSlug) {
        nextSlug = s;
      }
    }
  });

  if (!comicSlug) {
    comicSlug = cleanChapterSlug.replace(/-(?:ch|chapter)-[\d.-]+$/i, '');
  }

  const pages: ChapterPage[] = [];
  $('#Baca_Komik img').each((idx, img) => {
    const rawSrc = $(img).attr('src') || $(img).attr('data-src') || '';
    const cleanSrc = normalizeCoverUrl(rawSrc);
    if (!cleanSrc || cleanSrc.includes('/asset/img/lazy.jpg')) return;
    pages.push({
      page: pages.length + 1,
      image_url: cleanSrc,
      proxy_image_url: makeProxyImageUrl(cleanSrc),
    });
  });

  if (pages.length === 0 && !h1Text) return null;

  return {
    chapter_slug: cleanChapterSlug,
    chapter_id: hashSlugToId(cleanChapterSlug),
    comic_id: hashSlugToId(comicSlug),
    comic_slug: comicSlug,
    comic_title: comicTitle,
    chapter_number: chapterNum,
    chapter_title: h1Text || `Chapter ${chapterNum}`,
    released_label: 'Komiku.org',
    released_at: new Date().toISOString(),
    prev_chapter_slug: prevSlug,
    next_chapter_slug: nextSlug,
    total_pages: pages.length,
    source: 'komiku.org',
    pages,
  };
}
