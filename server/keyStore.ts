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
  requestsToday: number;
  requestsTotal: number;
  usageDate: string;
  status: 'active' | 'suspended';
  lastUsedAt: string | null;
  lastUserAgent: string | null;
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
const SECRET_FILE = path.join(DATA_DIR, 'session-secret.txt');

export const MAIN_ADMIN_EMAIL = 'predimahrobi@gmail.com';
const ADMIN_BOOTSTRAP_EMAILS = new Set([MAIN_ADMIN_EMAIL, 'sp.freemusichub@gmail.com']);
const REMOVED_DEMO_KEYS = new Set(['kmk_demo_nusakomik_id_2026']);

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
  private minuteHits: Map<string, { windowStart: number; count: number }>;
  private logs: ApiAccessLog[];

  constructor() {
    this.recordsByKey = new Map();
    this.keyByUid = new Map();
    this.uidByEmail = new Map();
    this.minuteHits = new Map();
    this.logs = [];
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(REGISTRY_FILE)) return;
      const raw = fs.readFileSync(REGISTRY_FILE, 'utf8');
      const list = JSON.parse(raw) as ApiKeyRecord[];
      let purgedDemo = false;
      for (const item of list) {
        if (!item?.apiKey || !item?.uid) continue;
        if (item.uid === 'sandbox-demo' || REMOVED_DEMO_KEYS.has(item.apiKey)) {
          purgedDemo = true;
          continue;
        }
        this.recordsByKey.set(item.apiKey, item);
        this.keyByUid.set(item.uid, item.apiKey);
        if (item.email) {
          this.uidByEmail.set(item.email.toLowerCase(), item.uid);
        }
      }
      if (purgedDemo) {
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
    status: 'active' | 'suspended';
  }): ApiKeyRecord {
    const today = getTodayString();
    const normalizedEmail = input.email.toLowerCase();
    const oldKey = this.keyByUid.get(input.uid);
    let prevRequestsToday = 0;
    let prevRequestsTotal = 0;
    let prevUsageDate = today;
    let prevLastUsed: string | null = null;
    let prevUserAgent: string | null = null;

    if (oldKey) {
      const oldRec = this.recordsByKey.get(oldKey);
      if (oldRec) {
        prevRequestsToday = oldRec.usageDate === today ? oldRec.requestsToday : 0;
        prevRequestsTotal = oldRec.requestsTotal;
        prevUsageDate = today;
        prevLastUsed = oldRec.lastUsedAt;
        prevUserAgent = oldRec.lastUserAgent;
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
        prevRequestsTotal += prevRec.requestsTotal;
        if (prevKey) this.recordsByKey.delete(prevKey);
        this.keyByUid.delete(prevEmailUid);
      }
    }

    const isBootstrappedAdmin = isBootstrapAdminEmail(normalizedEmail);
    const role: 'user' | 'admin' = isBootstrappedAdmin ? 'admin' : input.role;
    const plan: 'free' | 'pro' | 'admin_unlimited' = isBootstrappedAdmin ? 'admin_unlimited' : input.plan;
    const dailyLimit = role === 'admin' ? -1 : input.dailyLimit;

    const record: ApiKeyRecord = {
      apiKey: input.apiKey,
      uid: input.uid,
      email: input.email,
      displayName: input.displayName,
      role,
      plan,
      dailyLimit,
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
    if (rec && rec.usageDate !== getTodayString()) {
      rec.requestsToday = 0;
      rec.usageDate = getTodayString();
      this.saveToDisk();
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
      status: existing.status,
    });
  }

  updateUserByUid(
    uid: string,
    patch: Partial<Pick<ApiKeyRecord, 'role' | 'plan' | 'dailyLimit' | 'status' | 'apiKey'>>
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
    if (record.usageDate !== today) {
      record.usageDate = today;
      record.requestsToday = 0;
    }

    // Admin has unlimited daily and per-minute quota
    if (record.role === 'admin' || record.dailyLimit === -1) {
      record.requestsToday += 1;
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

    if (record.requestsToday >= record.dailyLimit) {
      return {
        allowed: false,
        statusCode: 429,
        error: `Kuota harian (${record.dailyLimit} request/hari) telah habis. Upgrade ke Pro atau tunggu reset harian.`,
        remaining: '0',
      };
    }

    record.requestsToday += 1;
    record.requestsTotal += 1;
    record.lastUsedAt = new Date().toISOString();
    record.lastUserAgent = userAgent.slice(0, 120);
    this.saveToDisk();

    return {
      allowed: true,
      statusCode: 200,
      record,
      remaining: String(Math.max(0, record.dailyLimit - record.requestsToday)),
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
