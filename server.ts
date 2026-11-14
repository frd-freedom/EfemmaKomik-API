import express from 'express';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { SmartCache } from './server/cache.ts';
import {
  getKomikuCatalog,
  getKomikuChapter,
  getKomikuDetail,
  getKomikuFilters,
} from './server/comicService.ts';
import {
  MAIN_ADMIN_EMAIL,
  generateServerApiKey,
  isBootstrapAdminEmail,
  issueSessionToken,
  keyStore,
  verifyFirebaseIdToken,
  verifyMainAdminCredentials,
  verifySessionToken,
} from './server/keyStore.ts';

function resolveServerPort(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if ((arg === '--port' || arg === '-p') && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    } else if (arg.startsWith('--port=')) {
      const parsed = Number(arg.slice('--port='.length));
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
  }
  const envPort = Number(process.env.PORT);
  if (Number.isInteger(envPort) && envPort > 0 && envPort !== 8080) {
    return envPort;
  }
  return 3000;
}

const PORT = resolveServerPort();
const cache = new SmartCache(500);

function isBlockedPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    h.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)
  ) {
    return true;
  }
  return false;
}

async function startServer() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use(
    '/covers',
    (_req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      next();
    },
    express.static(path.resolve('src/assets/images'))
  );

  // Anti-403 & CORS Headers Middleware
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-API-Key, x-api-key, Accept, User-Agent'
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-Cache, X-Cache-TTL, X-Response-Time, X-RateLimit-Limit, X-RateLimit-Remaining, X-Anti403-Status, ETag'
    );
    res.setHeader('X-Anti403-Status', 'curl-allowed');
    res.setHeader('Vary', 'Accept-Encoding');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: true,
      service: 'NusaKomik API (Komiku.org)',
      curl_ready: true,
      timestamp: new Date().toISOString(),
    });
  });

  // Public Web UI Endpoints (do not burn user API key quota)
  app.get('/api/public/stats', (_req: Request, res: Response) => {
    res.json({
      status: true,
      data: {
        total_titles: 8100,
        total_pages: 162,
        upstream_source: 'komiku.org',
        cache: cache.getStats(),
        curl_anti_403: 'active',
      },
    });
  });

  app.get('/api/public/filters', async (_req: Request, res: Response) => {
    const result = await cache.getOrFetch(
      'public:filters',
      () => getKomikuFilters(),
      { softTtlMs: 3_600_000, staleTtlMs: 7_200_000 }
    );
    res.setHeader('X-Cache', result.cacheStatus);
    res.json({ status: true, data: result.data });
  });

  app.get('/api/public/catalog', async (req: Request, res: Response) => {
    const category = String(req.query.category || 'terupdate') as
      | 'terupdate'
      | 'terpopuler'
      | 'trending'
      | 'rekomendasi'
      | 'berwarna'
      | 'perpustakaan'
      | 'all';
    const type = String(req.query.type || 'all');
    const genre = String(req.query.genre || 'all');
    const status = String(req.query.status || 'all');
    const sort = req.query.sort ? String(req.query.sort) : undefined;
    const period = req.query.period ? String(req.query.period) : undefined;
    const q = String(req.query.q || '');
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 24);

    try {
      const cacheKey = `public:catalog:${category}:${type}:${genre}:${status}:${sort || ''}:${period || ''}:${q}:${page}:${limit}`;
      const result = await cache.getOrFetch(
        cacheKey,
        () => getKomikuCatalog({ category, type, genre, status, sort, period, q, page, limit }),
        { softTtlMs: 180_000, staleTtlMs: 600_000 }
      );

      res.setHeader('X-Cache', result.cacheStatus);
      res.setHeader('X-Response-Time', `${result.elapsedMs}ms`);
      res.json({
        status: true,
        cache: result.cacheStatus,
        data: result.data,
      });
    } catch (err) {
      res.status(502).json({
        status: false,
        code: 502,
        message: err instanceof Error ? err.message : 'Gagal mengambil data dari Komiku.org',
      });
    }
  });

  app.get('/api/public/detail/:slug', async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const result = await cache.getOrFetch(
      `detail:${slug}`,
      () => getKomikuDetail(slug),
      { softTtlMs: 900_000, staleTtlMs: 1_800_000 }
    );
    if (!result.data) {
      res.status(404).json({ status: false, code: 404, message: 'Komik tidak ditemukan di Komiku.' });
      return;
    }
    res.setHeader('X-Cache', result.cacheStatus);
    res.json({ status: true, cache: result.cacheStatus, data: result.data });
  });

  app.get('/api/public/chapter/:chapterSlug', async (req: Request, res: Response) => {
    const chapterSlug = String(req.params.chapterSlug);
    const result = await cache.getOrFetch(
      `chapter:${chapterSlug}`,
      () => getKomikuChapter(chapterSlug),
      { softTtlMs: 1_800_000, staleTtlMs: 3_600_000 }
    );
    if (!result.data) {
      res.status(404).json({ status: false, code: 404, message: 'Chapter tidak ditemukan di Komiku.' });
      return;
    }
    res.setHeader('X-Cache', result.cacheStatus);
    res.json({ status: true, cache: result.cacheStatus, data: result.data });
  });

  // Upstream Image Proxy (supports thumbnail.komiku.to & img-komiku-org.translate.goog fallback)
  app.get('/api/v1/proxy/image', async (req: Request, res: Response) => {
    const targetUrl = String(req.query.url || '');
    const customRef = String(req.query.ref || 'https://komiku.org/');

    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      res.status(400).json({ status: false, code: 400, message: 'URL gambar tidak valid.' });
      return;
    }

    if ((parsed.protocol !== 'https:' && parsed.protocol !== 'http:') || isBlockedPrivateHost(parsed.hostname)) {
      res.status(400).json({ status: false, code: 400, message: 'Host gambar tidak diizinkan.' });
      return;
    }

    if (parsed.hostname === 'thumbnail.komiku.org') {
      parsed.hostname = 'thumbnail.komiku.to';
    }

    const candidates: string[] = [parsed.toString()];
    if (parsed.hostname.endsWith('komiku.org')) {
      const bridged = new URL(parsed.toString());
      bridged.hostname = `${parsed.hostname.replace(/\./g, '-')}.translate.goog`;
      candidates.push(bridged.toString());
    }

    for (const candidateUrl of candidates) {
      try {
        const upstream = await fetch(candidateUrl, {
          signal: AbortSignal.timeout(8000),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            Referer: customRef,
            Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          },
        });
        const contentType = upstream.headers.get('content-type') || '';
        if (upstream.ok && contentType.startsWith('image/')) {
          const buffer = Buffer.from(await upstream.arrayBuffer());
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.send(buffer);
          return;
        }
      } catch {
        // Try next candidate
      }
    }

    res.status(502).json({ status: false, code: 502, message: 'Gagal mengambil gambar upstream.' });
  });

  // Main Admin & Session Email Login
  app.post('/api/auth/email-login', (req: Request, res: Response) => {
    const body = req.body as { email?: string; password?: string };
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!email || !password) {
      res.status(400).json({ status: false, message: 'Email dan password wajib diisi.' });
      return;
    }

    if (email !== MAIN_ADMIN_EMAIL) {
      res.status(401).json({
        status: false,
        message: 'Gunakan autentikasi Firebase Email/Password atau Google OAuth untuk akun reguler.',
      });
      return;
    }

    if (!verifyMainAdminCredentials(email, password)) {
      res.status(401).json({ status: false, message: 'Email atau password admin utama salah.' });
      return;
    }

    const record = keyStore.ensureMainAdminRecord();
    const sessionToken = issueSessionToken({
      uid: record.uid,
      email: record.email,
      displayName: record.displayName,
      role: 'admin',
    });

    res.json({ status: true, sessionToken, data: record });
  });

  async function resolveAuthIdentity(
    req: Request
  ): Promise<{ uid: string; email: string; displayName: string; emailVerified: boolean; role?: 'user' | 'admin' } | null> {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return null;

    if (token.startsWith('nk_sess_')) {
      const sess = verifySessionToken(token);
      if (!sess) return null;
      return {
        uid: sess.uid,
        email: sess.email,
        displayName: sess.displayName,
        emailVerified: true,
        role: sess.role,
      };
    }

    const verified = await verifyFirebaseIdToken(token);
    if (!verified) return null;
    return {
      uid: verified.uid,
      email: verified.email,
      displayName: verified.displayName,
      emailVerified: verified.emailVerified,
    };
  }

  // Google OAuth / Verified Firebase User Sync
  app.post('/api/auth/sync', async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const verified = await verifyFirebaseIdToken(token);
    if (!verified || !verified.emailVerified) {
      res.status(401).json({ status: false, message: 'Token Firebase tidak valid atau email belum terverifikasi.' });
      return;
    }

    const body = req.body as {
      apiKey?: string;
      role?: 'user' | 'admin';
      plan?: 'free' | 'pro' | 'admin_unlimited';
      dailyLimit?: number;
      status?: 'active' | 'suspended';
    };

    if (!body?.apiKey || !/^kmk_[a-zA-Z0-9_]+$/.test(body.apiKey)) {
      res.status(400).json({ status: false, message: 'Format API Key tidak valid.' });
      return;
    }

    const isAdminEmail = isBootstrapAdminEmail(verified.email);
    const synced = keyStore.syncUserRecord({
      uid: verified.uid,
      email: verified.email,
      displayName: verified.displayName,
      apiKey: body.apiKey,
      role: isAdminEmail ? 'admin' : body.role === 'admin' ? 'admin' : 'user',
      plan: isAdminEmail ? 'admin_unlimited' : body.plan || 'free',
      dailyLimit: isAdminEmail ? -1 : typeof body.dailyLimit === 'number' ? body.dailyLimit : 1000,
      status: body.status === 'suspended' && !isAdminEmail ? 'suspended' : 'active',
    });

    res.json({ status: true, data: synced });
  });

  app.get('/api/user/usage', async (req: Request, res: Response) => {
    const identity = await resolveAuthIdentity(req);
    if (!identity) {
      res.status(401).json({ status: false, message: 'Unauthorized' });
      return;
    }
    const rec = keyStore.getByUid(identity.uid) || keyStore.getByEmail(identity.email);
    res.json({ status: true, data: rec });
  });

  app.post('/api/auth/regenerate-key', async (req: Request, res: Response) => {
    const identity = await resolveAuthIdentity(req);
    if (!identity || !identity.emailVerified) {
      res.status(401).json({ status: false, message: 'Unauthorized' });
      return;
    }
    const target = keyStore.getByUid(identity.uid) || keyStore.getByEmail(identity.email);
    if (!target) {
      res.status(404).json({ status: false, message: 'Profil API Key tidak ditemukan.' });
      return;
    }
    const updated = keyStore.regenerateKeyForUid(target.uid);
    res.json({ status: true, data: updated });
  });

  async function requireAdminToken(req: Request, res: Response): Promise<boolean> {
    const identity = await resolveAuthIdentity(req);
    if (!identity || !identity.emailVerified) {
      res.status(401).json({ status: false, message: 'Token autentikasi admin tidak valid.' });
      return false;
    }
    const existingRecord = keyStore.getByUid(identity.uid) || keyStore.getByEmail(identity.email);
    const isAdmin =
      isBootstrapAdminEmail(identity.email) || existingRecord?.role === 'admin' || identity.role === 'admin';
    if (!isAdmin) {
      res.status(403).json({ status: false, message: 'Akses ditolak. Memerlukan hak akses Admin.' });
      return false;
    }
    return true;
  }

  app.patch('/api/admin/users/:uid', async (req: Request, res: Response) => {
    if (!(await requireAdminToken(req, res))) return;
    const uid = String(req.params.uid);
    const body = req.body as {
      action?: 'update_plan' | 'toggle_role' | 'toggle_status' | 'reset_key';
      plan?: 'free' | 'pro' | 'admin_unlimited';
      role?: 'user' | 'admin';
      status?: 'active' | 'suspended';
    };

    const target = keyStore.getByUid(uid);
    if (!target) {
      res.status(404).json({ status: false, message: 'User tidak ditemukan.' });
      return;
    }

    if (body.action === 'reset_key') {
      const updated = keyStore.updateUserByUid(uid, {
        apiKey: generateServerApiKey(target.role === 'admin'),
      });
      res.json({ status: true, data: updated });
      return;
    }

    const nextRole = body.role ?? target.role;
    const nextPlan = body.plan ?? target.plan;
    const nextLimit = nextPlan === 'admin_unlimited' || nextRole === 'admin' ? -1 : nextPlan === 'pro' ? 10000 : 1000;
    const updated = keyStore.updateUserByUid(uid, {
      role: nextRole,
      plan: nextPlan,
      dailyLimit: nextLimit,
      status: body.status ?? target.status,
    });
    res.json({ status: true, data: updated });
  });

  app.post('/api/admin/sync-keys', async (req: Request, res: Response) => {
    if (!(await requireAdminToken(req, res))) return;
    const users = (req.body as { users?: Array<Parameters<typeof keyStore.syncUserRecord>[0]> }).users;
    if (!Array.isArray(users)) {
      res.status(400).json({ status: false, message: 'Payload users harus berupa array.' });
      return;
    }
    for (const u of users) {
      if (u?.uid && u?.apiKey && /^kmk_[a-zA-Z0-9_]+$/.test(u.apiKey)) {
        keyStore.syncUserRecord(u);
      }
    }
    res.json({ status: true, synced: users.length });
  });

  app.get('/api/admin/metrics', async (req: Request, res: Response) => {
    if (!(await requireAdminToken(req, res))) return;
    res.json({
      status: true,
      data: {
        cache: cache.getStats(),
        active_keys: keyStore.getAllRecords().length,
        usage_by_uid: keyStore.getAllRecords(),
        recent_logs: keyStore.getLogs(),
      },
    });
  });

  app.post('/api/admin/cache/flush', async (req: Request, res: Response) => {
    if (!(await requireAdminToken(req, res))) return;
    const cleared = cache.flush();
    res.json({ status: true, cleared_entries: cleared, message: 'Cache L1 berhasil dibersihkan.' });
  });

  app.post('/api/admin/catalog/refresh', async (req: Request, res: Response) => {
    if (!(await requireAdminToken(req, res))) return;
    cache.flush();
    const fresh = await getKomikuCatalog({ category: 'terupdate', page: 1, limit: 24 });
    res.json({
      status: true,
      data: {
        syncedCount: fresh.items.length,
        source: fresh.upstream_source,
        lastSyncAt: new Date().toISOString(),
      },
    });
  });

  // =========================================================================
  // DEVELOPER REST API v1 (/api/v1/komik/* & /api/v1/anime/*)
  // Accessible both in-browser (no curl needed) and via cURL on public hosts
  // =========================================================================
  function extractApiKey(req: Request): string {
    const headerKey = req.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey.trim()) return headerKey.trim();
    const authHeader = req.headers.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    if (typeof req.query.apikey === 'string' && req.query.apikey.trim()) {
      return req.query.apikey.trim();
    }
    if (typeof req.query.api_key === 'string' && req.query.api_key.trim()) {
      return req.query.api_key.trim();
    }
    return '';
  }

  function apiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
    const apiKey = extractApiKey(req);
    const ua = String(req.headers['user-agent'] || 'browser/fetch');

    if (!apiKey) {
      keyStore.recordLog({
        method: req.method,
        endpoint: req.originalUrl,
        statusCode: 401,
        cacheStatus: 'BYPASS',
        userAgent: ua.slice(0, 64),
        apiKeyPrefix: 'missing',
        role: 'anonymous',
        latencyMs: 0.2,
      });
      res.status(401).json({
        status: false,
        code: 401,
        message:
          'API Key wajib disertakan melalui header "x-api-key: <API_KEY>" atau query "?apikey=<API_KEY>".',
        hint: 'Silakan masuk melalui Email atau Google OAuth untuk mendapatkan API Key pribadi Anda.',
      });
      return;
    }

    const check = keyStore.validateAndConsume(apiKey, ua);
    if (!check.allowed || !check.record) {
      keyStore.recordLog({
        method: req.method,
        endpoint: req.originalUrl,
        statusCode: check.statusCode,
        cacheStatus: 'BYPASS',
        userAgent: ua.slice(0, 64),
        apiKeyPrefix: `${apiKey.slice(0, 10)}...`,
        role: 'unknown',
        latencyMs: 0.3,
      });
      res.status(check.statusCode).json({
        status: false,
        code: check.statusCode,
        message: check.error,
      });
      return;
    }

    res.locals.apiKeyRecord = check.record;
    res.locals.rateLimitRemaining = check.remaining;
    res.setHeader(
      'X-RateLimit-Limit',
      check.record.dailyLimit === -1 ? 'unlimited' : String(check.record.dailyLimit)
    );
    res.setHeader('X-RateLimit-Remaining', check.remaining);
    next();
  }

  function sendCachedApiResponse<T>(
    req: Request,
    res: Response,
    result: { data: T; cacheStatus: string; etag: string; ttlRemainingSec: number; elapsedMs: number }
  ): void {
    const rec = res.locals.apiKeyRecord as { apiKey: string; role: string; plan: string } | undefined;
    const ua = String(req.headers['user-agent'] || 'browser/fetch');
    keyStore.recordLog({
      method: req.method,
      endpoint: req.originalUrl,
      statusCode: 200,
      cacheStatus: result.cacheStatus,
      userAgent: ua.slice(0, 64),
      apiKeyPrefix: rec ? `${rec.apiKey.slice(0, 10)}...` : 'unknown',
      role: rec?.role ?? 'user',
      latencyMs: result.elapsedMs,
    });

    res.setHeader('ETag', result.etag);
    res.setHeader('X-Cache', result.cacheStatus);
    res.setHeader('X-Cache-TTL', `${result.ttlRemainingSec}s`);
    res.setHeader('X-Response-Time', `${result.elapsedMs}ms`);
    res.setHeader(
      'Cache-Control',
      `public, max-age=${Math.min(60, result.ttlRemainingSec)}, stale-while-revalidate=300`
    );

    if (req.headers['if-none-match'] === result.etag) {
      res.status(304).end();
      return;
    }

    res.json({
      status: true,
      code: 200,
      meta: {
        provider: 'NusaKomik API v1 (Komiku.org)',
        language: 'id',
        cache: result.cacheStatus,
        response_time_ms: result.elapsedMs,
        tier: rec?.plan ?? 'free',
        rate_limit_remaining: res.locals.rateLimitRemaining,
      },
      data: result.data,
    });
  }

  app.get('/api/v1/komik/terupdate', apiKeyMiddleware, async (req: Request, res: Response) => {
    try {
      const type = String(req.query.type || 'all');
      const genre = String(req.query.genre || 'all');
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const result = await cache.getOrFetch(
        `v1:terupdate:${type}:${genre}:${page}:${limit}`,
        () => getKomikuCatalog({ category: 'terupdate', type, genre, page, limit }),
        { softTtlMs: 300_000, staleTtlMs: 600_000 }
      );
      sendCachedApiResponse(req, res, result);
    } catch (err) {
      res.status(502).json({
        status: false,
        code: 502,
        message: err instanceof Error ? err.message : 'Gagal mengambil komik terupdate dari Komiku.org',
      });
    }
  });

  app.get('/api/v1/komik/terpopuler', apiKeyMiddleware, async (req: Request, res: Response) => {
    try {
      const type = String(req.query.type || 'all');
      const genre = String(req.query.genre || 'all');
      const period = String(req.query.period || 'harian');
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const result = await cache.getOrFetch(
        `v1:terpopuler:${type}:${genre}:${period}:${page}:${limit}`,
        () => getKomikuCatalog({ category: 'terpopuler', type, genre, period, page, limit }),
        { softTtlMs: 900_000, staleTtlMs: 1_800_000 }
      );
      sendCachedApiResponse(req, res, result);
    } catch (err) {
      res.status(502).json({
        status: false,
        code: 502,
        message: err instanceof Error ? err.message : 'Gagal mengambil komik terpopuler dari Komiku.org',
      });
    }
  });

  app.get('/api/v1/komik/trending', apiKeyMiddleware, async (req: Request, res: Response) => {
    try {
      const type = String(req.query.type || 'all');
      const genre = String(req.query.genre || 'all');
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const result = await cache.getOrFetch(
        `v1:trending:${type}:${genre}:${page}:${limit}`,
        () => getKomikuCatalog({ category: 'trending', type, genre, page, limit }),
        { softTtlMs: 600_000, staleTtlMs: 1_200_000 }
      );
      sendCachedApiResponse(req, res, result);
    } catch (err) {
      res.status(502).json({
        status: false,
        code: 502,
        message: err instanceof Error ? err.message : 'Gagal mengambil komik trending dari Komiku.org',
      });
    }
  });

  app.get('/api/v1/komik/rekomendasi', apiKeyMiddleware, async (req: Request, res: Response) => {
    try {
      const type = String(req.query.type || 'all');
      const genre = String(req.query.genre || 'all');
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const result = await cache.getOrFetch(
        `v1:rekomendasi:${type}:${genre}:${page}:${limit}`,
        () => getKomikuCatalog({ category: 'rekomendasi', type, genre, page, limit }),
        { softTtlMs: 900_000, staleTtlMs: 1_800_000 }
      );
      sendCachedApiResponse(req, res, result);
    } catch (err) {
      res.status(502).json({
        status: false,
        code: 502,
        message: err instanceof Error ? err.message : 'Gagal mengambil komik rekomendasi dari Komiku.org',
      });
    }
  });

  // Komik Berwarna (/other/berwarna/) dengan pagination
  app.get('/api/v1/komik/berwarna', apiKeyMiddleware, async (req: Request, res: Response) => {
    try {
      const type = String(req.query.type || 'all');
      const genre = String(req.query.genre || 'all');
      const q = String(req.query.q || '');
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 10);
      const result = await cache.getOrFetch(
        `v1:berwarna:${type}:${genre}:${q}:${page}:${limit}`,
        () => getKomikuCatalog({ category: 'berwarna', type, genre, q, page, limit }),
        { softTtlMs: 300_000, staleTtlMs: 900_000 }
      );
      sendCachedApiResponse(req, res, result);
    } catch (err) {
      res.status(502).json({
        status: false,
        code: 502,
        message: err instanceof Error ? err.message : 'Gagal mengambil komik berwarna dari Komiku.org',
      });
    }
  });

  // JSON Response By Type: /api/v1/komik/type/:type (manga | manhwa | manhua)
  app.get('/api/v1/komik/type/:type', apiKeyMiddleware, async (req: Request, res: Response) => {
    try {
      const type = String(req.params.type);
      const genre = String(req.query.genre || 'all');
      const sort = req.query.sort ? String(req.query.sort) : 'latest';
      const status = String(req.query.status || 'all');
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 24);
      const result = await cache.getOrFetch(
        `v1:type:${type}:${genre}:${sort}:${status}:${page}:${limit}`,
        () => getKomikuCatalog({ category: 'perpustakaan', type, genre, sort, status, page, limit }),
        { softTtlMs: 600_000, staleTtlMs: 1_200_000 }
      );
      sendCachedApiResponse(req, res, result);
    } catch (err) {
      res.status(502).json({
        status: false,
        code: 502,
        message: err instanceof Error ? err.message : 'Gagal mengambil daftar komik per tipe dari Komiku.org',
      });
    }
  });

  // JSON Response By Genre: /api/v1/komik/genre/:genre
  app.get('/api/v1/komik/genre/:genre', apiKeyMiddleware, async (req: Request, res: Response) => {
    try {
      const genre = String(req.params.genre);
      const type = String(req.query.type || 'all');
      const sort = req.query.sort ? String(req.query.sort) : 'latest';
      const status = String(req.query.status || 'all');
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 24);
      const result = await cache.getOrFetch(
        `v1:genre:${genre}:${type}:${sort}:${status}:${page}:${limit}`,
        () => getKomikuCatalog({ category: 'perpustakaan', type, genre, sort, status, page, limit }),
        { softTtlMs: 600_000, staleTtlMs: 1_200_000 }
      );
      sendCachedApiResponse(req, res, result);
    } catch (err) {
      res.status(502).json({
        status: false,
        code: 502,
        message: err instanceof Error ? err.message : 'Gagal mengambil daftar komik per genre dari Komiku.org',
      });
    }
  });

  // Perpustakaan Anime & Komik Komiku (with full pagination)
  async function handlePerpustakaan(req: Request, res: Response): Promise<void> {
    try {
      const type = String(req.query.type || 'all');
      const genre = String(req.query.genre || 'all');
      const status = String(req.query.status || 'all');
      const sort = req.query.sort ? String(req.query.sort) : 'latest';
      const q = String(req.query.q || '');
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 24);
      const result = await cache.getOrFetch(
        `v1:perpustakaan:${type}:${genre}:${status}:${sort}:${q}:${page}:${limit}`,
        () => getKomikuCatalog({ category: 'perpustakaan', type, genre, status, sort, q, page, limit }),
        { softTtlMs: 600_000, staleTtlMs: 1_200_000 }
      );
      sendCachedApiResponse(req, res, result);
    } catch (err) {
      res.status(502).json({
        status: false,
        code: 502,
        message: err instanceof Error ? err.message : 'Gagal mengambil perpustakaan dari Komiku.org',
      });
    }
  }

  app.get('/api/v1/komik/perpustakaan', apiKeyMiddleware, handlePerpustakaan);
  app.get('/api/v1/anime/perpustakaan', apiKeyMiddleware, handlePerpustakaan);

  app.get('/api/v1/komik/search', apiKeyMiddleware, async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q || '');
      const type = String(req.query.type || 'all');
      const genre = String(req.query.genre || 'all');
      const page = Number(req.query.page || 1);
      const limit = Number(req.query.limit || 20);
      const result = await cache.getOrFetch(
        `v1:search:${q}:${type}:${genre}:${page}:${limit}`,
        () => getKomikuCatalog({ category: 'all', q, type, genre, page, limit }),
        { softTtlMs: 300_000, staleTtlMs: 600_000 }
      );
      sendCachedApiResponse(req, res, result);
    } catch (err) {
      res.status(502).json({
        status: false,
        code: 502,
        message: err instanceof Error ? err.message : 'Gagal mencari komik di Komiku.org',
      });
    }
  });

  app.get('/api/v1/komik/genres', apiKeyMiddleware, async (req: Request, res: Response) => {
    const result = await cache.getOrFetch(
      'v1:filters',
      () => getKomikuFilters(),
      { softTtlMs: 3_600_000, staleTtlMs: 7_200_000 }
    );
    sendCachedApiResponse(req, res, result);
  });

  app.get('/api/v1/komik/detail/:slug', apiKeyMiddleware, async (req: Request, res: Response) => {
    const slug = String(req.params.slug);
    const result = await cache.getOrFetch(
      `v1:detail:${slug}`,
      () => getKomikuDetail(slug),
      { softTtlMs: 900_000, staleTtlMs: 1_800_000 }
    );
    if (!result.data) {
      res.status(404).json({
        status: false,
        code: 404,
        message: `Komik dengan slug '${slug}' tidak ditemukan di Komiku.`,
      });
      return;
    }
    sendCachedApiResponse(req, res, result);
  });

  app.get('/api/v1/komik/chapter/:chapterSlug', apiKeyMiddleware, async (req: Request, res: Response) => {
    const chapterSlug = String(req.params.chapterSlug);
    const result = await cache.getOrFetch(
      `v1:chapter:${chapterSlug}`,
      () => getKomikuChapter(chapterSlug),
      { softTtlMs: 1_800_000, staleTtlMs: 3_600_000 }
    );
    if (!result.data) {
      res.status(404).json({
        status: false,
        code: 404,
        message: `Chapter '${chapterSlug}' tidak ditemukan di Komiku.`,
      });
      return;
    }
    sendCachedApiResponse(req, res, result);
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({
      status: false,
      code: 404,
      message: 'Endpoint API tidak ditemukan. Periksa dokumentasi di /api/v1/komik/*',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NusaKomik API (Komiku.org) berjalan di http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Gagal menjalankan server:', err);
  process.exit(1);
});
