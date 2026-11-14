import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface ApiKeyRecord {
  apiKey: string;
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  plan: 'free' | 'pro' | 'admin_unlimited';
  dailyLimit: number; // -1 means unlimited
  monthlyLimit?: number; // > 0 when assigned a monthly token package
  requestsThisMonth?: number;
  usageMonth?: string;
  packageId?: string;
  packageName?: string;
  requestsToday: number;
  requestsTotal: number;
  usageDate: string;
  status: 'active' | 'suspended';
  lastUsedAt: string | null;
  lastUserAgent: string | null;
}

export interface PricingPackage {
  id: string;
  name: string;
  tagline: string;
  tokensPerMonth: number;
  priceIdr: number;
  billingPeriodLabel: string;
  features: string[];
  highlighted: boolean;
  active: boolean;
  ctaLabel: string;
}

export interface SiteSettings {
  freeDailyTokens: number;
  freePlanName: string;
  freePlanDescription: string;
  ownerWhatsappNumber: string;
  ownerWhatsappName: string;
  whatsappMessageTemplate: string;
  pricingHeadline: string;
  pricingSubtitle: string;
  billingNotice: string;
  packages: PricingPackage[];
  updatedAt: string;
}

export interface ApiAccessLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  statusCode: number;
  cacheStatus: string;
  userAgent: string;
  apiKeyPrefix: string;
  role: string;
  latencyMs: number;
}

const DATA_DIR = path.resolve('.data');
const REGISTRY_FILE = path.join(DATA_DIR, 'apikey-registry.json');
const EMAIL_ACCOUNTS_FILE = path.join(DATA_DIR, 'email-accounts.json');
const REQUEST_STATS_FILE = path.join(DATA_DIR, 'request-stats.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'site-settings.json');
const SECRET_FILE = path.join(DATA_DIR, 'session-secret.txt');

interface GlobalRequestStats {
  totalRequests: number;
  requestsToday: number;
  apiV1Requests: number;
  usageDate: string;
}

export const MAIN_ADMIN_EMAIL = 'predimahrobi@gmail.com';
const ADMIN_BOOTSTRAP_EMAILS = new Set([MAIN_ADMIN_EMAIL, 'sp.freemusichub@gmail.com']);
const REMOVED_DEMO_KEYS = new Set(['kmk_demo_nusakomik_id_2026']);

const DEFAULT_PACKAGES: PricingPackage[] = [
  {
    id: 'starter',
    name: 'Starter Token',
    tagline: 'Untuk bot pribadi, riset, & proyek indie',
    tokensPerMonth: 5000,
    priceIdr: 15000,
    billingPeriodLabel: '/bulan',
    features: [
      '5.000 token request / bulan',
      'Akses seluruh endpoint /api/v1/komik/*',
      'Dukungan cURL Anti-403 & JSON 200 OK',
    ],
    highlighted: false,
    active: true,
    ctaLabel: 'Beli via WhatsApp',
  },
  {
    id: 'pro',
    name: 'Pro Developer',
    tagline: 'Untuk website baca komik & aplikasi aktif',
    tokensPerMonth: 25000,
    priceIdr: 49000,
    billingPeriodLabel: '/bulan',
    features: [
      '25.000 token request / bulan',
      'Akses prioritas cache L1 & semua genre',
      'Link Raw JSON & cURL tanpa batasan harian ketat',
    ],
    highlighted: true,
    active: true,
    ctaLabel: 'Beli via WhatsApp',
  },
  {
    id: 'business',
    name: 'Business Scale',
    tagline: 'Untuk trafik tinggi & multi-aplikasi',
    tokensPerMonth: 100000,
    priceIdr: 149000,
    billingPeriodLabel: '/bulan',
    features: [
      '100.000 token request / bulan',
      'Kapasitas tinggi untuk sinkronisasi katalog & reader',
      'Dukungan langsung via WhatsApp Owner',
    ],
    highlighted: false,
    active: true,
    ctaLabel: 'Beli via WhatsApp',
  },
];

function createDefaultSiteSettings(): SiteSettings {
  return {
    freeDailyTokens: 10,
    freePlanName: 'Free',
    freePlanDescription: 'Akses gratis harian untuk mencoba seluruh endpoint REST API.',
    ownerWhatsappNumber: '6281234567890',
    ownerWhatsappName: 'Owner EfemmaKomik-API',
    whatsappMessageTemplate:
      'Halo {owner}, saya ingin membeli paket *{package_name}* ({tokens_per_month} token/bulan - {price}) untuk akun {user_email} (API Key: {api_key}).',
    pricingHeadline: 'Harga & Paket Token Request API',
    pricingSubtitle:
      'Setiap request ke endpoint /api/v1/* menggunakan 1 token. Upgrade ke paket bulanan untuk kuota lebih besar.',
    billingNotice:
      'Pembayaran otomatis sedang dalam tahap integrasi. Pemesanan paket token sementara dilayani langsung melalui WhatsApp Owner.',
    packages: DEFAULT_PACKAGES.map((p) => ({ ...p, features: [...p.features] })),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeWhatsappNumber(raw: string): string {
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

export function isBootstrapAdminEmail(email?: string | null): boolean {
  return Boolean(email && ADMIN_BOOTSTRAP_EMAILS.has(email.toLowerCase()));
}

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, 'utf8');
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const SESSION_SECRET = getSessionSecret();

export function verifyMainAdminCredentials(email: string, password: string): boolean {
  if (email.trim().toLowerCase() !== MAIN_ADMIN_EMAIL) return false;
  const expected = process.env.MAIN_ADMIN_PASSWORD || 'fredy2007';
  const a = Buffer.from(password, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

interface StoredEmailAccount {
  uid: string;
  email: string;
  displayName: string;
  salt: string;
  passwordHash: string;
  createdAt: string;
}

function hashPasswordScrypt(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPasswordScrypt(password: string, salt: string, storedHex: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(storedHex, 'hex');
    if (derived.length !== stored.length) return false;
    return crypto.timingSafeEqual(derived, stored);
  } catch {
    return false;
  }
}

export interface SessionTokenPayload {
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  exp: number;
}

export function issueSessionToken(payload: Omit<SessionTokenPayload, 'exp'>): string {
  const full: SessionTokenPayload = {
    ...payload,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  const body = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `nk_sess_${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  if (!token || !token.startsWith('nk_sess_')) return null;
  const raw = token.slice('nk_sess_'.length);
  const dotIdx = raw.indexOf('.');
  if (dotIdx <= 0) return null;
  const body = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionTokenPayload;
    if (!parsed?.uid || !parsed?.email || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function generateServerApiKey(isAdmin: boolean): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(24);
  let token = '';
  for (let i = 0; i < bytes.length; i += 1) {
    token += chars[bytes[i] % chars.length];
  }
  return `${isAdmin ? 'kmk_adm_' : 'kmk_usr_'}${token}`;
}

function getTodayString(): string {
  // Use WIB (UTC+7) date string so Indonesian daily quotas reset cleanly at midnight WIB
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function getCurrentMonthString(): string {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 7);
}

interface FirebaseConfigFile {
  apiKey: string;
  projectId: string;
}

function getFirebaseConfig(): FirebaseConfigFile {
  const configPath = path.resolve('firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw) as FirebaseConfigFile;
}

export interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoUrl: string;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  if (!idToken || idToken.length < 20 || idToken.startsWith('nk_sess_')) return null;
  try {
    const config = getFirebaseConfig();
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
        photoUrl?: string;
      }>;
    };
    const user = payload.users?.[0];
    if (!user || !user.localId || !user.email) return null;
    return {
      uid: user.localId,
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
      displayName: user.displayName || user.email.split('@')[0],
      photoUrl: user.photoUrl || '',
    };
  } catch {
    return null;
  }
}

class KeyStore {
  private recordsByKey: Map<string, ApiKeyRecord>;
  private keyByUid: Map<string, string>;
  private uidByEmail: Map<string, string>;
  private emailAccounts: Map<string, StoredEmailAccount>;
  private minuteHits: Map<string, { windowStart: number; count: number }>;
  private logs: ApiAccessLog[];
  private globalStats: GlobalRequestStats;
  private siteSettings: SiteSettings;

  constructor() {
    this.recordsByKey = new Map();
    this.keyByUid = new Map();
    this.uidByEmail = new Map();
    this.emailAccounts = new Map();
    this.minuteHits = new Map();
    this.logs = [];
    this.globalStats = {
      totalRequests: 0,
      requestsToday: 0,
      apiV1Requests: 0,
      usageDate: getTodayString(),
    };
    this.siteSettings = createDefaultSiteSettings();
    this.loadSiteSettings();
    this.loadFromDisk();
    this.loadEmailAccounts();
    this.loadGlobalStats();
  }

  private loadSiteSettings(): void {
    try {
      if (!fs.existsSync(SETTINGS_FILE)) {
        this.saveSiteSettings();
        return;
      }
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(raw) as Partial<SiteSettings>;
      const defaults = createDefaultSiteSettings();
      const packages = Array.isArray(parsed.packages)
        ? parsed.packages.map((p, idx) => ({
            id: String(p?.id || `pkg_${idx + 1}`).slice(0, 48),
            name: String(p?.name || `Paket ${idx + 1}`).slice(0, 80),
            tagline: String(p?.tagline || '').slice(0, 160),
            tokensPerMonth: Math.max(1, Math.floor(Number(p?.tokensPerMonth || 1000))),
            priceIdr: Math.max(0, Math.floor(Number(p?.priceIdr || 0))),
            billingPeriodLabel: String(p?.billingPeriodLabel || '/bulan').slice(0, 24),
            features: Array.isArray(p?.features)
              ? p.features.map((f) => String(f).trim()).filter(Boolean).slice(0, 12)
              : [],
            highlighted: Boolean(p?.highlighted),
            active: p?.active !== false,
            ctaLabel: String(p?.ctaLabel || 'Beli via WhatsApp').slice(0, 48),
          }))
        : defaults.packages;

      this.siteSettings = {
        freeDailyTokens: Math.max(1, Math.floor(Number(parsed.freeDailyTokens ?? defaults.freeDailyTokens))),
        freePlanName: String(parsed.freePlanName || defaults.freePlanName).slice(0, 60),
        freePlanDescription: String(parsed.freePlanDescription || defaults.freePlanDescription).slice(0, 240),
        ownerWhatsappNumber: String(parsed.ownerWhatsappNumber ?? defaults.ownerWhatsappNumber).slice(0, 32),
        ownerWhatsappName: String(parsed.ownerWhatsappName || defaults.ownerWhatsappName).slice(0, 80),
        whatsappMessageTemplate: String(
          parsed.whatsappMessageTemplate || defaults.whatsappMessageTemplate
        ).slice(0, 600),
        pricingHeadline: String(parsed.pricingHeadline || defaults.pricingHeadline).slice(0, 140),
        pricingSubtitle: String(parsed.pricingSubtitle || defaults.pricingSubtitle).slice(0, 300),
        billingNotice: String(parsed.billingNotice || defaults.billingNotice).slice(0, 300),
        packages,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      };
    } catch {
      this.siteSettings = createDefaultSiteSettings();
    }
  }

  private saveSiteSettings(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(this.siteSettings, null, 2), 'utf8');
    } catch {
      // Non-fatal
    }
  }

  getSiteSettings(): SiteSettings {
    return {
      ...this.siteSettings,
      packages: this.siteSettings.packages.map((p) => ({ ...p, features: [...p.features] })),
    };
  }

  updateSiteSettings(patch: Partial<SiteSettings>): SiteSettings {
    const current = this.siteSettings;
    const nextFreeDaily =
      typeof patch.freeDailyTokens === 'number' && Number.isFinite(patch.freeDailyTokens)
        ? Math.max(1, Math.min(1000000, Math.floor(patch.freeDailyTokens)))
        : current.freeDailyTokens;

    const nextPackages = Array.isArray(patch.packages)
      ? patch.packages.map((p, idx) => ({
          id: String(p?.id || `pkg_${idx + 1}`).trim().slice(0, 48) || `pkg_${idx + 1}`,
          name: String(p?.name || `Paket ${idx + 1}`).trim().slice(0, 80),
          tagline: String(p?.tagline || '').trim().slice(0, 160),
          tokensPerMonth: Math.max(1, Math.floor(Number(p?.tokensPerMonth || 100))),
          priceIdr: Math.max(0, Math.floor(Number(p?.priceIdr || 0))),
          billingPeriodLabel: String(p?.billingPeriodLabel || '/bulan').trim().slice(0, 24) || '/bulan',
          features: Array.isArray(p?.features)
            ? p.features.map((f) => String(f).trim()).filter(Boolean).slice(0, 12)
            : [],
          highlighted: Boolean(p?.highlighted),
          active: p?.active !== false,
          ctaLabel: String(p?.ctaLabel || 'Beli via WhatsApp').trim().slice(0, 48) || 'Beli via WhatsApp',
        }))
      : current.packages;

    this.siteSettings = {
      freeDailyTokens: nextFreeDaily,
      freePlanName:
        typeof patch.freePlanName === 'string' && patch.freePlanName.trim()
          ? patch.freePlanName.trim().slice(0, 60)
          : current.freePlanName,
      freePlanDescription:
        typeof patch.freePlanDescription === 'string'
          ? patch.freePlanDescription.trim().slice(0, 240)
          : current.freePlanDescription,
      ownerWhatsappNumber:
        typeof patch.ownerWhatsappNumber === 'string'
          ? patch.ownerWhatsappNumber.trim().slice(0, 32)
          : current.ownerWhatsappNumber,
      ownerWhatsappName:
        typeof patch.ownerWhatsappName === 'string' && patch.ownerWhatsappName.trim()
          ? patch.ownerWhatsappName.trim().slice(0, 80)
          : current.ownerWhatsappName,
      whatsappMessageTemplate:
        typeof patch.whatsappMessageTemplate === 'string' && patch.whatsappMessageTemplate.trim()
          ? patch.whatsappMessageTemplate.trim().slice(0, 600)
          : current.whatsappMessageTemplate,
      pricingHeadline:
        typeof patch.pricingHeadline === 'string' && patch.pricingHeadline.trim()
          ? patch.pricingHeadline.trim().slice(0, 140)
          : current.pricingHeadline,
      pricingSubtitle:
        typeof patch.pricingSubtitle === 'string'
          ? patch.pricingSubtitle.trim().slice(0, 300)
          : current.pricingSubtitle,
      billingNotice:
        typeof patch.billingNotice === 'string'
          ? patch.billingNotice.trim().slice(0, 300)
          : current.billingNotice,
      packages: nextPackages,
      updatedAt: new Date().toISOString(),
    };

    this.saveSiteSettings();

    // Propagate updated freeDailyTokens to all free non-admin users
    let changedRecords = false;
    for (const rec of this.recordsByKey.values()) {
      if (rec.role !== 'admin' && rec.plan === 'free' && rec.dailyLimit !== nextFreeDaily) {
        rec.dailyLimit = nextFreeDaily;
        changedRecords = true;
      }
    }
    if (changedRecords) {
      this.saveToDisk();
    }

    return this.getSiteSettings();
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(REGISTRY_FILE)) return;
      const raw = fs.readFileSync(REGISTRY_FILE, 'utf8');
      const list = JSON.parse(raw) as ApiKeyRecord[];
      let dirty = false;
      for (const item of list) {
        if (!item?.apiKey || !item?.uid) continue;
        if (item.uid === 'sandbox-demo' || REMOVED_DEMO_KEYS.has(item.apiKey)) {
          dirty = true;
          continue;
        }
        if (item.role !== 'admin' && item.plan === 'free' && item.dailyLimit !== this.siteSettings.freeDailyTokens) {
          item.dailyLimit = this.siteSettings.freeDailyTokens;
          dirty = true;
        }
        this.recordsByKey.set(item.apiKey, item);
        this.keyByUid.set(item.uid, item.apiKey);
        if (item.email) {
          this.uidByEmail.set(item.email.toLowerCase(), item.uid);
        }
      }
      if (dirty) {
        this.saveToDisk();
      }
    } catch {
      // Ignore corrupt file on cold start
    }
  }

  private saveToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const list = Array.from(this.recordsByKey.values());
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch {
      // Non-fatal in read-only environments
    }
  }

  private loadEmailAccounts(): void {
    try {
      if (!fs.existsSync(EMAIL_ACCOUNTS_FILE)) return;
      const raw = fs.readFileSync(EMAIL_ACCOUNTS_FILE, 'utf8');
      const list = JSON.parse(raw) as StoredEmailAccount[];
      for (const acc of list) {
        if (!acc?.email || !acc?.uid || !acc?.salt || !acc?.passwordHash) continue;
        this.emailAccounts.set(acc.email.toLowerCase(), acc);
      }
    } catch {
      // Ignore corrupt email accounts file on cold start
    }
  }

  private saveEmailAccounts(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const list = Array.from(this.emailAccounts.values());
      fs.writeFileSync(EMAIL_ACCOUNTS_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch {
      // Non-fatal
    }
  }

  private loadGlobalStats(): void {
    const today = getTodayString();
    let baselineTotal = 0;
    let baselineToday = 0;
    for (const rec of this.recordsByKey.values()) {
      baselineTotal += rec.requestsTotal || 0;
      if (rec.usageDate === today) {
        baselineToday += rec.requestsToday || 0;
      }
    }

    try {
      if (fs.existsSync(REQUEST_STATS_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(REQUEST_STATS_FILE, 'utf8')) as Partial<GlobalRequestStats>;
        const sameDay = parsed.usageDate === today;
        this.globalStats = {
          totalRequests: Math.max(baselineTotal, Number(parsed.totalRequests || 0)),
          requestsToday: sameDay ? Math.max(baselineToday, Number(parsed.requestsToday || 0)) : baselineToday,
          apiV1Requests: Math.max(baselineTotal, Number(parsed.apiV1Requests || 0)),
          usageDate: today,
        };
        return;
      }
    } catch {
      // Fall back to baseline
    }

    this.globalStats = {
      totalRequests: baselineTotal,
      requestsToday: baselineToday,
      apiV1Requests: baselineTotal,
      usageDate: today,
    };
  }

  private saveGlobalStats(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(REQUEST_STATS_FILE, JSON.stringify(this.globalStats, null, 2), 'utf8');
    } catch {
      // Non-fatal
    }
  }

  recordRequest(kind: 'public' | 'v1'): void {
    const today = getTodayString();
    if (this.globalStats.usageDate !== today) {
      this.globalStats.usageDate = today;
      this.globalStats.requestsToday = 0;
    }
    this.globalStats.totalRequests += 1;
    this.globalStats.requestsToday += 1;
    if (kind === 'v1') {
      this.globalStats.apiV1Requests += 1;
    }
    this.saveGlobalStats();
  }

  getGlobalRequestStats(): GlobalRequestStats {
    const today = getTodayString();
    if (this.globalStats.usageDate !== today) {
      this.globalStats.usageDate = today;
      this.globalStats.requestsToday = 0;
      this.saveGlobalStats();
    }
    return { ...this.globalStats };
  }

  registerEmailAccount(
    displayName: string,
    rawEmail: string,
    password: string
  ): { ok: true; record: ApiKeyRecord } | { ok: false; status: number; message: string } {
    const email = rawEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, status: 400, message: 'Format email tidak valid.' };
    }
    if (password.length < 6) {
      return { ok: false, status: 400, message: 'Password minimal harus 6 karakter.' };
    }
    if (email === MAIN_ADMIN_EMAIL || this.emailAccounts.has(email)) {
      return { ok: false, status: 409, message: 'Email sudah terdaftar. Silakan masuk dengan password Anda.' };
    }

    const existingRecord = this.getByEmail(email);
    const uid = existingRecord?.uid || `usr_${crypto.randomBytes(12).toString('hex')}`;
    const safeName = (displayName || email.split('@')[0] || 'Developer').trim().slice(0, 120);
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPasswordScrypt(password, salt);

    this.emailAccounts.set(email, {
      uid,
      email,
      displayName: safeName,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
    });
    this.saveEmailAccounts();

    const isAdmin = isBootstrapAdminEmail(email);
    const record = this.syncUserRecord({
      uid,
      email,
      displayName: safeName,
      apiKey: existingRecord?.apiKey || generateServerApiKey(isAdmin),
      role: isAdmin ? 'admin' : 'user',
      plan: isAdmin ? 'admin_unlimited' : 'free',
      dailyLimit: isAdmin ? -1 : this.siteSettings.freeDailyTokens,
      status: 'active',
    });

    return { ok: true, record };
  }

  verifyEmailAccountCredentials(rawEmail: string, password: string): ApiKeyRecord | null {
    const email = rawEmail.trim().toLowerCase();
    if (email === MAIN_ADMIN_EMAIL) {
      if (!verifyMainAdminCredentials(email, password)) return null;
      return this.ensureMainAdminRecord();
    }

    const acc = this.emailAccounts.get(email);
    if (!acc) return null;
    if (!verifyPasswordScrypt(password, acc.salt, acc.passwordHash)) return null;

    const existing = this.getByUid(acc.uid) || this.getByEmail(email);
    if (existing) return existing;

    const isAdmin = isBootstrapAdminEmail(email);
    return this.syncUserRecord({
      uid: acc.uid,
      email: acc.email,
      displayName: acc.displayName,
      apiKey: generateServerApiKey(isAdmin),
      role: isAdmin ? 'admin' : 'user',
      plan: isAdmin ? 'admin_unlimited' : 'free',
      dailyLimit: isAdmin ? -1 : this.siteSettings.freeDailyTokens,
      status: 'active',
    });
  }

  ensureMainAdminRecord(): ApiKeyRecord {
    const existingUid = this.uidByEmail.get(MAIN_ADMIN_EMAIL);
    if (existingUid) {
      const existing = this.getByUid(existingUid);
      if (existing) {
        if (existing.role !== 'admin' || existing.plan !== 'admin_unlimited' || existing.dailyLimit !== -1 || existing.status !== 'active') {
          return this.syncUserRecord({
            uid: existing.uid,
            email: existing.email,
            displayName: existing.displayName || 'Admin Utama',
            apiKey: existing.apiKey,
            role: 'admin',
            plan: 'admin_unlimited',
            dailyLimit: -1,
            status: 'active',
          });
        }
        return existing;
      }
    }

    return this.syncUserRecord({
      uid: 'admin-utama-predimahrobi',
      email: MAIN_ADMIN_EMAIL,
      displayName: 'Admin Utama',
      apiKey: generateServerApiKey(true),
      role: 'admin',
      plan: 'admin_unlimited',
      dailyLimit: -1,
      status: 'active',
    });
  }

  syncUserRecord(input: {
    uid: string;
    email: string;
    displayName: string;
    apiKey: string;
    role: 'user' | 'admin';
    plan: 'free' | 'pro' | 'admin_unlimited';
    dailyLimit: number;
    monthlyLimit?: number;
    packageId?: string;
    packageName?: string;
    status: 'active' | 'suspended';
  }): ApiKeyRecord {
    const today = getTodayString();
    const currentMonth = getCurrentMonthString();
    const normalizedEmail = input.email.toLowerCase();
    const oldKey = this.keyByUid.get(input.uid);
    let prevRequestsToday = 0;
    let prevRequestsThisMonth = 0;
    let prevRequestsTotal = 0;
    let prevUsageDate = today;
    let prevUsageMonth = currentMonth;
    let prevLastUsed: string | null = null;
    let prevUserAgent: string | null = null;
    let prevMonthlyLimit: number | undefined;
    let prevPackageId: string | undefined;
    let prevPackageName: string | undefined;

    if (oldKey) {
      const oldRec = this.recordsByKey.get(oldKey);
      if (oldRec) {
        prevRequestsToday = oldRec.usageDate === today ? oldRec.requestsToday : 0;
        prevRequestsThisMonth = oldRec.usageMonth === currentMonth ? (oldRec.requestsThisMonth || 0) : 0;
        prevRequestsTotal = oldRec.requestsTotal;
        prevUsageDate = today;
        prevUsageMonth = currentMonth;
        prevLastUsed = oldRec.lastUsedAt;
        prevUserAgent = oldRec.lastUserAgent;
        prevMonthlyLimit = oldRec.monthlyLimit;
        prevPackageId = oldRec.packageId;
        prevPackageName = oldRec.packageName;
      }
      if (oldKey !== input.apiKey) {
        this.recordsByKey.delete(oldKey);
      }
    }

    // If this email previously had an admin-utama record under another UID, carry forward key/stats cleanly
    const prevEmailUid = this.uidByEmail.get(normalizedEmail);
    if (prevEmailUid && prevEmailUid !== input.uid) {
      const prevKey = this.keyByUid.get(prevEmailUid);
      const prevRec = prevKey ? this.recordsByKey.get(prevKey) : undefined;
      if (prevRec) {
        prevRequestsToday += prevRec.usageDate === today ? prevRec.requestsToday : 0;
        prevRequestsThisMonth += prevRec.usageMonth === currentMonth ? (prevRec.requestsThisMonth || 0) : 0;
        prevRequestsTotal += prevRec.requestsTotal;
        if (prevKey) this.recordsByKey.delete(prevKey);
        this.keyByUid.delete(prevEmailUid);
      }
    }

    const isBootstrappedAdmin = isBootstrapAdminEmail(normalizedEmail);
    const role: 'user' | 'admin' = isBootstrappedAdmin ? 'admin' : input.role;
    const plan: 'free' | 'pro' | 'admin_unlimited' = isBootstrappedAdmin ? 'admin_unlimited' : input.plan;
    const dailyLimit =
      role === 'admin'
        ? -1
        : plan === 'free'
          ? this.siteSettings.freeDailyTokens
          : input.dailyLimit;

    const monthlyLimit =
      role === 'admin' || plan !== 'pro'
        ? undefined
        : input.monthlyLimit !== undefined
          ? input.monthlyLimit
          : prevMonthlyLimit;

    const packageId =
      plan === 'pro' ? (input.packageId !== undefined ? input.packageId : prevPackageId) : undefined;
    const packageName =
      plan === 'pro' ? (input.packageName !== undefined ? input.packageName : prevPackageName) : undefined;

    const record: ApiKeyRecord = {
      apiKey: input.apiKey,
      uid: input.uid,
      email: input.email,
      displayName: input.displayName,
      role,
      plan,
      dailyLimit,
      ...(monthlyLimit ? { monthlyLimit } : {}),
      requestsThisMonth: prevRequestsThisMonth,
      usageMonth: prevUsageMonth,
      ...(packageId ? { packageId } : {}),
      ...(packageName ? { packageName } : {}),
      requestsToday: prevRequestsToday,
      requestsTotal: prevRequestsTotal,
      usageDate: prevUsageDate,
      status: isBootstrappedAdmin ? 'active' : input.status,
      lastUsedAt: prevLastUsed,
      lastUserAgent: prevUserAgent,
    };

    this.recordsByKey.set(input.apiKey, record);
    this.keyByUid.set(input.uid, input.apiKey);
    if (normalizedEmail) {
      this.uidByEmail.set(normalizedEmail, input.uid);
    }
    this.saveToDisk();
    return record;
  }

  getByUid(uid: string): ApiKeyRecord | null {
    const key = this.keyByUid.get(uid);
    if (!key) return null;
    const rec = this.recordsByKey.get(key) ?? null;
    if (rec) {
      let changed = false;
      const today = getTodayString();
      const month = getCurrentMonthString();
      if (rec.usageDate !== today) {
        rec.requestsToday = 0;
        rec.usageDate = today;
        changed = true;
      }
      if (rec.usageMonth !== month) {
        rec.requestsThisMonth = 0;
        rec.usageMonth = month;
        changed = true;
      }
      if (rec.role !== 'admin' && rec.plan === 'free' && rec.dailyLimit !== this.siteSettings.freeDailyTokens) {
        rec.dailyLimit = this.siteSettings.freeDailyTokens;
        changed = true;
      }
      if (changed) {
        this.saveToDisk();
      }
    }
    return rec;
  }

  getByEmail(email: string): ApiKeyRecord | null {
    const uid = this.uidByEmail.get(email.toLowerCase());
    return uid ? this.getByUid(uid) : null;
  }

  regenerateKeyForUid(uid: string): ApiKeyRecord | null {
    const existing = this.getByUid(uid);
    if (!existing) return null;
    const nextKey = generateServerApiKey(existing.role === 'admin');
    return this.syncUserRecord({
      uid: existing.uid,
      email: existing.email,
      displayName: existing.displayName,
      apiKey: nextKey,
      role: existing.role,
      plan: existing.plan,
      dailyLimit: existing.dailyLimit,
      monthlyLimit: existing.monthlyLimit,
      packageId: existing.packageId,
      packageName: existing.packageName,
      status: existing.status,
    });
  }

  updateUserByUid(
    uid: string,
    patch: Partial<
      Pick<ApiKeyRecord, 'role' | 'plan' | 'dailyLimit' | 'monthlyLimit' | 'packageId' | 'packageName' | 'status' | 'apiKey'>
    >
  ): ApiKeyRecord | null {
    const existing = this.getByUid(uid);
    if (!existing) return null;
    return this.syncUserRecord({
      uid: existing.uid,
      email: existing.email,
      displayName: existing.displayName,
      apiKey: patch.apiKey ?? existing.apiKey,
      role: patch.role ?? existing.role,
      plan: patch.plan ?? existing.plan,
      dailyLimit: patch.dailyLimit ?? existing.dailyLimit,
      monthlyLimit: 'monthlyLimit' in patch ? patch.monthlyLimit : existing.monthlyLimit,
      packageId: 'packageId' in patch ? patch.packageId : existing.packageId,
      packageName: 'packageName' in patch ? patch.packageName : existing.packageName,
      status: patch.status ?? existing.status,
    });
  }

  getAllRecords(): ApiKeyRecord[] {
    return Array.from(this.recordsByKey.values()).filter((r) => r.uid !== 'sandbox-demo');
  }

  validateAndConsume(
    apiKey: string,
    userAgent: string
  ): {
    allowed: boolean;
    statusCode: number;
    error?: string;
    record?: ApiKeyRecord;
    remaining: string;
  } {
    const record = this.recordsByKey.get(apiKey);
    if (!record) {
      return {
        allowed: false,
        statusCode: 401,
        error: 'API Key tidak valid atau belum terdaftar. Silakan masuk via Email atau Google untuk mendapatkan API Key aktif.',
        remaining: '0',
      };
    }

    if (record.status === 'suspended') {
      return {
        allowed: false,
        statusCode: 403,
        error: 'API Key Anda sedang dinonaktifkan oleh administrator.',
        remaining: '0',
      };
    }

    const today = getTodayString();
    const currentMonth = getCurrentMonthString();
    if (record.usageDate !== today) {
      record.usageDate = today;
      record.requestsToday = 0;
    }
    if (record.usageMonth !== currentMonth) {
      record.usageMonth = currentMonth;
      record.requestsThisMonth = 0;
    }

    // Admin has unlimited daily and per-minute quota
    if (record.role === 'admin' || record.plan === 'admin_unlimited' || (record.dailyLimit === -1 && !record.monthlyLimit)) {
      record.requestsToday += 1;
      record.requestsThisMonth = (record.requestsThisMonth || 0) + 1;
      record.requestsTotal += 1;
      record.lastUsedAt = new Date().toISOString();
      record.lastUserAgent = userAgent.slice(0, 120);
      this.saveToDisk();
      return {
        allowed: true,
        statusCode: 200,
        record,
        remaining: 'unlimited',
      };
    }

    // Per-minute burst guard (60 req/min for non-admin)
    const now = Date.now();
    const minuteState = this.minuteHits.get(apiKey);
    if (!minuteState || now - minuteState.windowStart > 60_000) {
      this.minuteHits.set(apiKey, { windowStart: now, count: 1 });
    } else {
      if (minuteState.count >= 60) {
        return {
          allowed: false,
          statusCode: 429,
          error: 'Batas burst 60 request/menit tercapai. Tunggu beberapa detik atau gunakan caching di sisi klien.',
          remaining: '0',
        };
      }
      minuteState.count += 1;
    }

    // Monthly token quota (assigned via Pricing package)
    if (record.plan === 'pro' && record.monthlyLimit && record.monthlyLimit > 0) {
      const usedMonth = record.requestsThisMonth || 0;
      if (usedMonth >= record.monthlyLimit) {
        return {
          allowed: false,
          statusCode: 429,
          error: `Kuota token bulanan (${record.monthlyLimit.toLocaleString('id-ID')} token/bulan) telah habis. Silakan perpanjang token di halaman Pricing.`,
          remaining: '0',
        };
      }
      record.requestsToday += 1;
      record.requestsThisMonth = usedMonth + 1;
      record.requestsTotal += 1;
      record.lastUsedAt = new Date().toISOString();
      record.lastUserAgent = userAgent.slice(0, 120);
      this.saveToDisk();
      return {
        allowed: true,
        statusCode: 200,
        record,
        remaining: String(Math.max(0, record.monthlyLimit - record.requestsThisMonth)),
      };
    }

    const effectiveDailyLimit =
      record.plan === 'free' ? this.siteSettings.freeDailyTokens : record.dailyLimit;

    if (record.requestsToday >= effectiveDailyLimit) {
      return {
        allowed: false,
        statusCode: 429,
        error: `Token request harian (${effectiveDailyLimit.toLocaleString('id-ID')} token/hari) telah habis. Beli paket token bulanan di halaman Pricing atau tunggu reset pukul 00:00 WIB.`,
        remaining: '0',
      };
    }

    record.requestsToday += 1;
    record.requestsThisMonth = (record.requestsThisMonth || 0) + 1;
    record.requestsTotal += 1;
    record.lastUsedAt = new Date().toISOString();
    record.lastUserAgent = userAgent.slice(0, 120);
    this.saveToDisk();

    return {
      allowed: true,
      statusCode: 200,
      record,
      remaining: String(Math.max(0, effectiveDailyLimit - record.requestsToday)),
    };
  }

  recordLog(log: Omit<ApiAccessLog, 'id' | 'timestamp'>): void {
    this.logs.unshift({
      ...log,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    });
    if (this.logs.length > 50) {
      this.logs.length = 50;
    }
  }

  getLogs(): ApiAccessLog[] {
    return this.logs;
  }
}

export const keyStore = new KeyStore();
export const ADMIN_BOOTSTRAP_EMAIL = MAIN_ADMIN_EMAIL;
