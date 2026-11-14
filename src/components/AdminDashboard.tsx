import React, { useCallback, useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Check,
  Coins,
  Copy,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { generateApiKey, useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import { SelectDropdown } from './SelectDropdown';
import type {
  ApiAccessLog,
  CacheStats,
  PricingPackage,
  ServerKeyUsage,
  SiteSettings,
  UserPlan,
  UserProfile,
  UserRole,
} from '../types';

function serverUsageToProfile(item: ServerKeyUsage): UserProfile {
  return {
    uid: item.uid,
    email: item.email,
    displayName: item.displayName,
    photoURL: '',
    role: item.role,
    plan: item.plan,
    apiKey: item.apiKey,
    dailyLimit: item.dailyLimit,
    monthlyLimit: item.monthlyLimit,
    requestsThisMonth: item.requestsThisMonth,
    usageMonth: item.usageMonth,
    packageId: item.packageId,
    packageName: item.packageName,
    requestsToday: item.requestsToday,
    requestsTotal: item.requestsTotal,
    status: item.status,
    lastLoginAt: item.lastUsedAt || undefined,
  };
}

type AdminTab = 'users' | 'pricing';

interface QuotaModalState {
  user: UserProfile;
  dailyLimit: string;
  monthlyLimit: string;
}

export function AdminDashboard() {
  const { firebaseUser, userProfile, getIdToken } = useAuth();
  const { settings, refreshSettings } = useSettings();

  const [adminTab, setAdminTab] = useState<AdminTab>('users');
  const [firestoreUsers, setFirestoreUsers] = useState<UserProfile[]>([]);
  const [backendUsers, setBackendUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [usageMap, setUsageMap] = useState<Record<string, ServerKeyUsage>>({});
  const [logs, setLogs] = useState<ApiAccessLog[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // Custom quota edit modal
  const [quotaModal, setQuotaModal] = useState<QuotaModalState | null>(null);
  useBodyScrollLock(Boolean(quotaModal));

  // Pricing & token settings form draft
  const [draftSettings, setDraftSettings] = useState<SiteSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  const isAdmin = userProfile?.role === 'admin';
  const hasVerifiedFirebase = Boolean(firebaseUser && firebaseUser.emailVerified);

  const fetchBackendMetrics = useCallback(async () => {
    const token = await getIdToken();
    if (!token) {
      setLoadingUsers(false);
      return;
    }
    try {
      const res = await fetch('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          status: boolean;
          data?: {
            cache: CacheStats;
            usage_by_uid: ServerKeyUsage[];
            recent_logs: ApiAccessLog[];
          };
        };
        if (json.data) {
          setCacheStats(json.data.cache);
          setLogs(json.data.recent_logs);
          const map: Record<string, ServerKeyUsage> = {};
          const mappedUsers: UserProfile[] = [];
          for (const item of json.data.usage_by_uid) {
            map[item.uid] = item;
            mappedUsers.push(serverUsageToProfile(item));
          }
          setUsageMap(map);
          setBackendUsers(mappedUsers);
        }
      }
    } catch {
      // Ignore network hiccup
    } finally {
      if (!hasVerifiedFirebase) {
        setLoadingUsers(false);
      }
    }
  }, [getIdToken, hasVerifiedFirebase]);

  const syncKeysToBackend = useCallback(
    async (userList: UserProfile[]) => {
      const token = await getIdToken();
      if (!token || userList.length === 0) return;
      try {
        await fetch('/api/admin/sync-keys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            users: userList.map((u) => ({
              uid: u.uid,
              email: u.email,
              displayName: u.displayName,
              apiKey: u.apiKey,
              role: u.role,
              plan: u.plan,
              dailyLimit: u.dailyLimit,
              status: u.status,
            })),
          }),
        });
      } catch {
        // Non-blocking sync
      }
    },
    [getIdToken]
  );

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    void fetchBackendMetrics();

    if (!hasVerifiedFirebase) {
      setFirestoreUsers([]);
      return;
    }

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: UserProfile[] = snapshot.docs.map((d) => d.data() as UserProfile);
        setFirestoreUsers(list);
        setLoadingUsers(false);
        void syncKeysToBackend(list);
      },
      (error) => {
        setLoadingUsers(false);
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );
    return () => unsub();
  }, [isAdmin, hasVerifiedFirebase, fetchBackendMetrics, syncKeysToBackend]);

  const firestoreUids = new Set(firestoreUsers.map((u) => u.uid));
  const users: UserProfile[] = (() => {
    if (!hasVerifiedFirebase) return backendUsers;
    const byUid = new Map<string, UserProfile>();
    for (const u of firestoreUsers) {
      const srv = usageMap[u.uid];
      byUid.set(
        u.uid,
        srv
          ? {
              ...u,
              dailyLimit: srv.dailyLimit,
              monthlyLimit: srv.monthlyLimit,
              requestsThisMonth: srv.requestsThisMonth,
              usageMonth: srv.usageMonth,
              packageId: srv.packageId,
              packageName: srv.packageName,
            }
          : u
      );
    }
    for (const u of backendUsers) {
      if (!byUid.has(u.uid)) byUid.set(u.uid, u);
    }
    return Array.from(byUid.values());
  })();

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
        <ShieldAlert className="mx-auto h-8 w-8 text-rose-700 dark:text-rose-400" />
        <h1 className="mt-3 font-display text-xl font-bold text-slate-900 dark:text-slate-100">Akses Terbatas Admin</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Halaman ini hanya dapat diakses oleh akun administrator yang terverifikasi.
        </p>
      </div>
    );
  }

  const showNotice = (msg: string) => {
    setErrorNotice(null);
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const showError = (msg: string) => {
    setNotice(null);
    setErrorNotice(msg);
    setTimeout(() => setErrorNotice(null), 4000);
  };

  const patchBackendUser = async (uid: string, payload: Record<string, unknown>) => {
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error('Gagal memperbarui data pengguna di server.');
    }
  };

  const handlePlanOrPackageChange = async (user: UserProfile, selection: string) => {
    setBusyAction(user.uid);
    try {
      if (selection.startsWith('pkg:')) {
        const pkgId = selection.slice(4);
        const pkg = settings.packages.find((p) => p.id === pkgId);
        if (!pkg) return;

        await patchBackendUser(user.uid, {
          action: 'assign_package',
          packageId: pkg.id,
          packageName: pkg.name,
          monthlyLimit: pkg.tokensPerMonth,
        });

        if (hasVerifiedFirebase && firestoreUids.has(user.uid)) {
          await updateDoc(doc(db, 'users', user.uid), {
            plan: 'pro',
            dailyLimit: pkg.tokensPerMonth,
            updatedAt: serverTimestamp(),
          });
        }
        await fetchBackendMetrics();
        showNotice(
          `${user.displayName} diaktifkan ke ${pkg.name} (${pkg.tokensPerMonth.toLocaleString('id-ID')} token/bln).`
        );
        return;
      }

      const nextPlan = selection as UserPlan;
      const nextLimit =
        nextPlan === 'admin_unlimited'
          ? -1
          : nextPlan === 'pro'
            ? settings.packages[0]?.tokensPerMonth || 25000
            : settings.freeDailyTokens;
      const nextRole: UserRole = nextPlan === 'admin_unlimited' ? 'admin' : user.role;

      await patchBackendUser(user.uid, { action: 'update_plan', plan: nextPlan, role: nextRole });
      if (hasVerifiedFirebase && firestoreUids.has(user.uid)) {
        await updateDoc(doc(db, 'users', user.uid), {
          plan: nextPlan,
          dailyLimit: nextLimit,
          role: nextRole,
          updatedAt: serverTimestamp(),
        });
        if (nextRole === 'admin') {
          await setDoc(doc(db, 'admins', user.uid), {
            uid: user.uid,
            email: user.email,
            grantedBy: userProfile.uid,
            createdAt: serverTimestamp(),
          });
        }
      }
      await fetchBackendMetrics();
      showNotice(`Paket ${user.displayName} diperbarui ke ${nextPlan}.`);
    } catch (err) {
      if (hasVerifiedFirebase) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      } else {
        showError(err instanceof Error ? err.message : 'Gagal memperbarui paket pengguna.');
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveCustomQuota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotaModal) return;
    const { user, dailyLimit, monthlyLimit } = quotaModal;
    const parsedDaily = Math.max(-1, Math.floor(Number(dailyLimit) || settings.freeDailyTokens));
    const parsedMonthly = monthlyLimit.trim() ? Math.max(0, Math.floor(Number(monthlyLimit) || 0)) : 0;

    setBusyAction(user.uid);
    try {
      await patchBackendUser(user.uid, {
        action: 'update_quota',
        dailyLimit: parsedDaily,
        monthlyLimit: parsedMonthly > 0 ? parsedMonthly : undefined,
      });
      if (hasVerifiedFirebase && firestoreUids.has(user.uid)) {
        await updateDoc(doc(db, 'users', user.uid), {
          dailyLimit: parsedMonthly > 0 ? parsedMonthly : parsedDaily,
          updatedAt: serverTimestamp(),
        });
      }
      await fetchBackendMetrics();
      setQuotaModal(null);
      showNotice(`Kuota khusus ${user.displayName} berhasil disimpan.`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal menyimpan kuota khusus.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleRole = async (user: UserProfile) => {
    if (user.uid === userProfile.uid) return;
    const nextRole: UserRole = user.role === 'admin' ? 'user' : 'admin';
    const nextPlan: UserPlan = nextRole === 'admin' ? 'admin_unlimited' : 'free';
    const nextLimit = nextRole === 'admin' ? -1 : settings.freeDailyTokens;
    setBusyAction(user.uid);
    try {
      await patchBackendUser(user.uid, { action: 'toggle_role', role: nextRole, plan: nextPlan });
      if (hasVerifiedFirebase && firestoreUids.has(user.uid)) {
        await updateDoc(doc(db, 'users', user.uid), {
          role: nextRole,
          plan: nextPlan,
          dailyLimit: nextLimit,
          updatedAt: serverTimestamp(),
        });
        if (nextRole === 'admin') {
          await setDoc(doc(db, 'admins', user.uid), {
            uid: user.uid,
            email: user.email,
            grantedBy: userProfile.uid,
            createdAt: serverTimestamp(),
          });
        } else {
          await deleteDoc(doc(db, 'admins', user.uid));
        }
      }
      await fetchBackendMetrics();
      showNotice(`Role ${user.displayName} diubah menjadi ${nextRole}.`);
    } catch (err) {
      if (hasVerifiedFirebase) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleStatus = async (user: UserProfile) => {
    if (user.uid === userProfile.uid) return;
    const nextStatus = user.status === 'active' ? 'suspended' : 'active';
    setBusyAction(user.uid);
    try {
      await patchBackendUser(user.uid, { action: 'toggle_status', status: nextStatus });
      if (hasVerifiedFirebase && firestoreUids.has(user.uid)) {
        await updateDoc(doc(db, 'users', user.uid), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
        });
      }
      await fetchBackendMetrics();
      showNotice(`Status ${user.displayName} diubah ke ${nextStatus}.`);
    } catch (err) {
      if (hasVerifiedFirebase) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleRegenerateUserKey = async (user: UserProfile) => {
    const nextKey = generateApiKey(user.role === 'admin');
    setBusyAction(user.uid);
    try {
      if (hasVerifiedFirebase && firestoreUids.has(user.uid)) {
        await updateDoc(doc(db, 'users', user.uid), {
          apiKey: nextKey,
          updatedAt: serverTimestamp(),
        });
      } else {
        await patchBackendUser(user.uid, { action: 'reset_key' });
      }
      await fetchBackendMetrics();
      showNotice(`API Key baru dibuat untuk ${user.displayName}.`);
    } catch (err) {
      if (hasVerifiedFirebase) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleFlushCache = async () => {
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch('/api/admin/cache/flush', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchBackendMetrics();
      showNotice('Cache L1 server berhasil dibersihkan.');
    }
  };

  const handleRefreshCatalog = async () => {
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch('/api/admin/catalog/refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await fetchBackendMetrics();
      showNotice('Katalog komik berhasil disinkronisasi ulang.');
    }
  };

  // Pricing & Token Settings Handlers
  const updatePackageField = <K extends keyof PricingPackage>(
    idx: number,
    field: K,
    value: PricingPackage[K]
  ) => {
    setDraftSettings((prev) => {
      const next = [...prev.packages];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, packages: next };
    });
  };

  const addPackage = () => {
    const id = `pkg_${Date.now().toString(36)}`;
    setDraftSettings((prev) => ({
      ...prev,
      packages: [
        ...prev.packages,
        {
          id,
          name: 'Paket Baru',
          tagline: 'Paket token request bulanan',
          tokensPerMonth: 10000,
          priceIdr: 29000,
          billingPeriodLabel: '/bulan',
          features: ['10.000 token request / bulan', 'Akses seluruh endpoint /api/v1/*'],
          highlighted: false,
          active: true,
          ctaLabel: 'Beli via WhatsApp',
        },
      ],
    }));
  };

  const removePackage = (idx: number) => {
    setDraftSettings((prev) => ({
      ...prev,
      packages: prev.packages.filter((_, i) => i !== idx),
    }));
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getIdToken();
    if (!token) {
      showError('Sesi admin tidak valid. Silakan login ulang.');
      return;
    }
    setSavingSettings(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          freeDailyTokens: Math.max(1, Math.floor(Number(draftSettings.freeDailyTokens) || 10)),
          freePlanName: draftSettings.freePlanName,
          freePlanDescription: draftSettings.freePlanDescription,
          ownerWhatsappNumber: draftSettings.ownerWhatsappNumber,
          ownerWhatsappName: draftSettings.ownerWhatsappName,
          whatsappMessageTemplate: draftSettings.whatsappMessageTemplate,
          pricingHeadline: draftSettings.pricingHeadline,
          pricingSubtitle: draftSettings.pricingSubtitle,
          billingNotice: draftSettings.billingNotice,
          packages: draftSettings.packages,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message || 'Gagal menyimpan pengaturan.');
      }
      await Promise.all([refreshSettings(), fetchBackendMetrics()]);
      showNotice('Pengaturan kuota token & halaman Pricing berhasil disimpan.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.');
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.apiKey.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatDate = (val: unknown): string => {
    if (!val) return '-';
    if (typeof val === 'string') {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }
    if (
      typeof val === 'object' &&
      val !== null &&
      'toDate' in val &&
      typeof (val as { toDate: () => Date }).toDate === 'function'
    ) {
      return (val as { toDate: () => Date }).toDate().toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return '-';
  };

  const userPlanOptions = [
    { value: 'free', label: `Free (${settings.freeDailyTokens.toLocaleString('id-ID')}/hr)` },
    ...settings.packages.map((pkg) => ({
      value: `pkg:${pkg.id}`,
      label: `${pkg.name} (${pkg.tokensPerMonth.toLocaleString('id-ID')}/bln)`,
    })),
    { value: 'admin_unlimited', label: 'Unlimited (Admin)' },
  ];

  const resolveDropdownValue = (u: UserProfile): string => {
    if (u.plan === 'admin_unlimited' || u.role === 'admin') return 'admin_unlimited';
    if (u.plan === 'pro') {
      if (u.packageId && settings.packages.some((p) => p.id === u.packageId)) {
        return `pkg:${u.packageId}`;
      }
      const firstPkg = settings.packages[0];
      return firstPkg ? `pkg:${firstPkg.id}` : 'free';
    }
    return 'free';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 sm:pb-6 dark:border-slate-800">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
            Dashboard Admin &amp; Kontrol Token
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Kelola pengguna, API Key, kuota token Free, paket Pricing bulanan, kontak WhatsApp Owner, dan cache server.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchBackendMetrics()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Metrik
          </button>
          <button
            type="button"
            onClick={() => void handleRefreshCatalog()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Sinkronisasi Katalog
          </button>
          <button
            type="button"
            onClick={() => void handleFlushCache()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-rose-700 dark:hover:bg-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Flush Cache
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setAdminTab('users')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
            adminTab === 'users'
              ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Pengguna &amp; API Key ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setAdminTab('pricing')}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
            adminTab === 'pricing'
              ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-800 dark:text-white'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          }`}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Pengaturan Token &amp; Pricing
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {errorNotice && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
          {errorNotice}
        </div>
      )}

      {/* Server Cache & User KPIs */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4 dark:border-slate-800 dark:bg-slate-800">
        <div className="bg-white p-4 sm:p-5 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total User Database</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-950 tabular-nums dark:text-slate-50 sm:text-2xl">
            {users.length}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {users.filter((u) => u.status === 'active').length} aktif · {users.filter((u) => u.role === 'admin').length} admin
          </p>
        </div>
        <div className="bg-white p-4 sm:p-5 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">Kuota User Free</p>
          <p className="mt-1 font-display text-xl font-bold text-rose-700 tabular-nums dark:text-rose-400 sm:text-2xl">
            {settings.freeDailyTokens.toLocaleString('id-ID')} / hari
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {settings.packages.filter((p) => p.active).length} paket bulanan aktif
          </p>
        </div>
        <div className="bg-white p-4 sm:p-5 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">Cache Hit Ratio</p>
          <p className="mt-1 font-display text-xl font-bold text-emerald-700 tabular-nums dark:text-emerald-400 sm:text-2xl">
            {cacheStats?.hitRatePercent ?? 100}%
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums dark:text-slate-400">
            {cacheStats?.hits ?? 0} hit · {cacheStats?.staleServes ?? 0} SWR
          </p>
        </div>
        <div className="bg-white p-4 sm:p-5 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">Rata-rata Latensi</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-950 tabular-nums dark:text-slate-50 sm:text-2xl">
            {cacheStats?.avgResponseMs ?? 0.4} ms
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">cURL Anti-403 aktif</p>
        </div>
      </div>

      {adminTab === 'pricing' ? (
        <form onSubmit={(e) => void handleSaveSettings(e)} className="space-y-8">
          {/* Free Tier & WhatsApp Settings */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-rose-700 dark:text-rose-400" />
                <h2 className="font-display text-base font-bold text-slate-950 dark:text-slate-100">
                  Kuota Paket Free (Default Semua User)
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="set-free-tokens" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Token per Hari (User Free)
                  </label>
                  <input
                    id="set-free-tokens"
                    type="number"
                    min={1}
                    max={1000000}
                    required
                    value={draftSettings.freeDailyTokens}
                    onChange={(e) =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        freeDailyTokens: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm font-semibold text-slate-950 tabular-nums focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Mengubah nilai ini otomatis memperbarui kuota harian seluruh user berpaket Free.
                  </p>
                </div>

                <div>
                  <label htmlFor="set-free-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nama Paket Free
                  </label>
                  <input
                    id="set-free-name"
                    type="text"
                    required
                    value={draftSettings.freePlanName}
                    onChange={(e) =>
                      setDraftSettings((prev) => ({ ...prev, freePlanName: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="set-free-desc" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Deskripsi Paket Free di Halaman Pricing
                </label>
                <textarea
                  id="set-free-desc"
                  rows={2}
                  value={draftSettings.freePlanDescription}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({ ...prev, freePlanDescription: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-display text-base font-bold text-slate-950 dark:text-slate-100">
                WhatsApp Owner (Fallback Pemesanan Token)
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="set-wa-number" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nomor WhatsApp (Format 628xxx)
                  </label>
                  <input
                    id="set-wa-number"
                    type="text"
                    required
                    value={draftSettings.ownerWhatsappNumber}
                    onChange={(e) =>
                      setDraftSettings((prev) => ({ ...prev, ownerWhatsappNumber: e.target.value }))
                    }
                    placeholder="6281234567890"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-950 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label htmlFor="set-wa-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nama Owner / Admin
                  </label>
                  <input
                    id="set-wa-name"
                    type="text"
                    required
                    value={draftSettings.ownerWhatsappName}
                    onChange={(e) =>
                      setDraftSettings((prev) => ({ ...prev, ownerWhatsappName: e.target.value }))
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="set-wa-tpl" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Template Pesan WhatsApp
                </label>
                <textarea
                  id="set-wa-tpl"
                  rows={3}
                  value={draftSettings.whatsappMessageTemplate}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({ ...prev, whatsappMessageTemplate: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Variabel: <code>{'{owner}'}</code>, <code>{'{package_name}'}</code>, <code>{'{tokens_per_month}'}</code>,{' '}
                  <code>{'{price}'}</code>, <code>{'{user_email}'}</code>, <code>{'{api_key}'}</code>
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Page Copy */}
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="font-display text-base font-bold text-slate-950 dark:text-slate-100">
              Teks &amp; Pengumuman Halaman Pricing
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="set-pricing-head" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Judul Halaman Pricing
                </label>
                <input
                  id="set-pricing-head"
                  type="text"
                  value={draftSettings.pricingHeadline}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({ ...prev, pricingHeadline: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
              <div>
                <label htmlFor="set-pricing-sub" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Subjudul Halaman Pricing
                </label>
                <input
                  id="set-pricing-sub"
                  type="text"
                  value={draftSettings.pricingSubtitle}
                  onChange={(e) =>
                    setDraftSettings((prev) => ({ ...prev, pricingSubtitle: e.target.value }))
                  }
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>
            </div>
            <div>
              <label htmlFor="set-billing-notice" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Catatan Pembayaran (Banner Fallback WhatsApp)
              </label>
              <input
                id="set-billing-notice"
                type="text"
                value={draftSettings.billingNotice}
                onChange={(e) =>
                  setDraftSettings((prev) => ({ ...prev, billingNotice: e.target.value }))
                }
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Monthly Token Packages */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-100">
                  Paket Token Bulanan ({draftSettings.packages.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Atur jumlah token/bulan, harga IDR, daftar fitur, dan status tampil setiap paket.
                </p>
              </div>
              <button
                type="button"
                onClick={addPackage}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Paket Token
              </button>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {draftSettings.packages.map((pkg, idx) => (
                <div
                  key={`${pkg.id}-${idx}`}
                  className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-rose-700 dark:text-rose-400">
                        #{idx + 1}
                      </span>
                      <span className="font-display text-sm font-bold text-slate-950 dark:text-slate-100">
                        {pkg.name || 'Paket Tanpa Nama'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePackage(idx)}
                      className="inline-flex items-center gap-1 rounded border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="h-3 w-3" />
                      Hapus
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Nama Paket
                      </label>
                      <input
                        type="text"
                        required
                        value={pkg.name}
                        onChange={(e) => updatePackageField(idx, 'name', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-950 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Tagline Singkat
                      </label>
                      <input
                        type="text"
                        value={pkg.tagline}
                        onChange={(e) => updatePackageField(idx, 'tagline', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-950 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Token / Bulan
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={pkg.tokensPerMonth}
                        onChange={(e) =>
                          updatePackageField(idx, 'tokensPerMonth', Math.max(1, Number(e.target.value) || 1))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-950 tabular-nums focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Harga (IDR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={pkg.priceIdr}
                        onChange={(e) =>
                          updatePackageField(idx, 'priceIdr', Math.max(0, Number(e.target.value) || 0))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs text-slate-950 tabular-nums focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Label Periode
                      </label>
                      <input
                        type="text"
                        value={pkg.billingPeriodLabel}
                        onChange={(e) => updatePackageField(idx, 'billingPeriodLabel', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-950 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Teks Tombol CTA
                      </label>
                      <input
                        type="text"
                        value={pkg.ctaLabel}
                        onChange={(e) => updatePackageField(idx, 'ctaLabel', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-950 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-4 pt-5">
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={pkg.active}
                          onChange={(e) => updatePackageField(idx, 'active', e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-rose-700 focus:ring-rose-700"
                        />
                        Aktif di Pricing
                      </label>
                      <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={pkg.highlighted}
                          onChange={(e) => updatePackageField(idx, 'highlighted', e.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-rose-700 focus:ring-rose-700"
                        />
                        Highlight Populer
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                      Daftar Fitur (1 baris per fitur)
                    </label>
                    <textarea
                      rows={3}
                      value={pkg.features.join('\n')}
                      onChange={(e) =>
                        updatePackageField(
                          idx,
                          'features',
                          e.target.value
                            .split('\n')
                            .map((line) => line.trim())
                            .filter(Boolean)
                        )
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-5 dark:border-slate-800">
            <button
              type="submit"
              disabled={savingSettings}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-800 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingSettings ? 'Menyimpan Pengaturan...' : 'Simpan Pengaturan Token & Pricing'}
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* All Database Users Table */}
          <div className="space-y-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                Semua Data User di Database ({filteredUsers.length})
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-auto">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama, email, API key..."
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 sm:w-56"
                  />
                </div>

                <SelectDropdown
                  ariaLabel="Filter role pengguna"
                  value={roleFilter}
                  onChange={(next) => setRoleFilter(next as 'all' | UserRole)}
                  className="w-36"
                  buttonClassName="py-1.5"
                  options={[
                    { value: 'all', label: 'Semua Role' },
                    { value: 'admin', label: 'Admin' },
                    { value: 'user', label: 'User' },
                  ]}
                />

                <SelectDropdown
                  ariaLabel="Filter status pengguna"
                  value={statusFilter}
                  onChange={(next) => setStatusFilter(next as 'all' | 'active' | 'suspended')}
                  menuAlign="right"
                  className="w-36"
                  buttonClassName="py-1.5"
                  options={[
                    { value: 'all', label: 'Semua Status' },
                    { value: 'active', label: 'Active' },
                    { value: 'suspended', label: 'Suspended' },
                  ]}
                />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Pengguna</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Paket / Kuota Token</th>
                    <th className="px-4 py-3">API Key</th>
                    <th className="px-4 py-3 text-right">Pemakaian (Hr / Bln / Total)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Login Terakhir</th>
                    <th className="px-4 py-3 text-right">Aksi Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        Memuat seluruh pengguna dari database...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                        Tidak ada user yang cocok dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const serverUsage = usageMap[u.uid];
                      const todayHits = serverUsage?.requestsToday ?? u.requestsToday ?? 0;
                      const monthHits = serverUsage?.requestsThisMonth ?? u.requestsThisMonth ?? 0;
                      const totalHits = serverUsage?.requestsTotal ?? u.requestsTotal ?? 0;
                      const monthlyLim = serverUsage?.monthlyLimit ?? u.monthlyLimit ?? 0;
                      const isSelf = u.uid === userProfile.uid;

                      return (
                        <tr key={u.uid} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {u.photoURL ? (
                                <img
                                  src={u.photoURL}
                                  alt={u.displayName}
                                  referrerPolicy="no-referrer"
                                  className="h-7 w-7 rounded-full border border-slate-200 object-cover shrink-0 dark:border-slate-700"
                                />
                              ) : (
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white shrink-0 dark:bg-rose-700">
                                  {u.displayName.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900 truncate max-w-[160px] dark:text-slate-100">
                                  {u.displayName}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate max-w-[180px] dark:text-slate-400">
                                  {u.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={
                                u.role === 'admin'
                                  ? 'font-semibold text-rose-700 dark:text-rose-400'
                                  : 'text-slate-700 dark:text-slate-300'
                              }
                            >
                              {u.role}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <SelectDropdown
                                ariaLabel={`Ubah paket ${u.displayName}`}
                                disabled={busyAction === u.uid || isSelf}
                                value={resolveDropdownValue(u)}
                                onChange={(next) => void handlePlanOrPackageChange(u, next)}
                                portal
                                className="w-48"
                                buttonClassName="py-1"
                                options={userPlanOptions}
                              />
                              {monthlyLim > 0 && u.plan === 'pro' && (
                                <p className="font-mono text-[10px] text-slate-500 tabular-nums dark:text-slate-400">
                                  Kuota bln: {monthlyLim.toLocaleString('id-ID')} token
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <code className="font-mono text-[11px] text-slate-800 dark:text-slate-200">
                                {u.apiKey.slice(0, 12)}...{u.apiKey.slice(-4)}
                              </code>
                              <button
                                type="button"
                                onClick={() => {
                                  void navigator.clipboard.writeText(u.apiKey);
                                  setCopiedUid(u.uid);
                                  setTimeout(() => setCopiedUid(null), 1500);
                                }}
                                title="Salin API Key"
                                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                              >
                                {copiedUid === u.uid ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap dark:text-slate-200">
                            {todayHits.toLocaleString('id-ID')} / {monthHits.toLocaleString('id-ID')} /{' '}
                            {totalHits.toLocaleString('id-ID')}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={
                                u.status === 'active'
                                  ? 'font-medium text-emerald-700 dark:text-emerald-400'
                                  : 'font-medium text-rose-700 dark:text-rose-400'
                              }
                            >
                              {u.status === 'active' ? 'Aktif' : 'Suspended'}
                            </span>
                          </td>

                          <td className="px-4 py-3 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap dark:text-slate-400">
                            {formatDate(u.lastLoginAt)}
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              {!isSelf && (
                                <button
                                  type="button"
                                  disabled={busyAction === u.uid}
                                  onClick={() =>
                                    setQuotaModal({
                                      user: u,
                                      dailyLimit: String(u.dailyLimit),
                                      monthlyLimit: monthlyLim > 0 ? String(monthlyLim) : '',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                >
                                  <SlidersHorizontal className="h-3 w-3" />
                                  Kuota
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={busyAction === u.uid}
                                onClick={() => void handleRegenerateUserKey(u)}
                                className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                Reset Key
                              </button>
                              {!isSelf && (
                                <>
                                  <button
                                    type="button"
                                    disabled={busyAction === u.uid}
                                    onClick={() => void handleToggleRole(u)}
                                    className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                  >
                                    {u.role === 'admin' ? 'Jadikan User' : 'Jadikan Admin'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busyAction === u.uid}
                                    onClick={() => void handleToggleStatus(u)}
                                    className={`rounded border px-2 py-1 text-[11px] font-medium disabled:opacity-40 ${
                                      u.status === 'active'
                                        ? 'border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40'
                                        : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/60 dark:text-emerald-400 dark:hover:bg-emerald-950/40'
                                    }`}
                                  >
                                    {u.status === 'active' ? 'Suspend' : 'Aktifkan'}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live API Request Logs */}
          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
              Log Request API Terbaru (cURL &amp; Klien)
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-2.5">Waktu</th>
                    <th className="px-4 py-2.5">Endpoint</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Cache</th>
                    <th className="px-4 py-2.5">User-Agent</th>
                    <th className="px-4 py-2.5 text-right">Latensi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px] dark:divide-slate-800">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-center font-sans text-xs text-slate-500 dark:text-slate-400">
                        Belum ada request ke endpoint `/api/v1/komik/*` pada sesi server ini.
                      </td>
                    </tr>
                  ) : (
                    logs.slice(0, 15).map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2 text-slate-500 tabular-nums whitespace-nowrap dark:text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                        </td>
                        <td className="px-4 py-2 text-slate-900 max-w-xs truncate dark:text-slate-100">{log.endpoint}</td>
                        <td
                          className={`px-4 py-2 font-semibold tabular-nums ${
                            log.statusCode === 200
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }`}
                        >
                          {log.statusCode}
                        </td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{log.cacheStatus}</td>
                        <td className="px-4 py-2 text-slate-500 max-w-[200px] truncate dark:text-slate-400">
                          {log.userAgent}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-700 tabular-nums dark:text-slate-300">
                          {log.latencyMs} ms
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Custom Quota Modal */}
      {quotaModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Atur Kuota Token Pengguna"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overscroll-none"
          onClick={() => setQuotaModal(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Atur Kuota Khusus</p>
                <h2 className="font-display text-base font-bold text-slate-950 dark:text-slate-100">
                  {quotaModal.user.displayName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{quotaModal.user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setQuotaModal(null)}
                aria-label="Tutup modal kuota"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSaveCustomQuota(e)} className="space-y-4 p-5">
              <div>
                <label htmlFor="qm-daily" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Kuota Harian (`-1` untuk Unlimited)
                </label>
                <input
                  id="qm-daily"
                  type="number"
                  min={-1}
                  required
                  value={quotaModal.dailyLimit}
                  onChange={(e) => setQuotaModal((prev) => (prev ? { ...prev, dailyLimit: e.target.value } : null))}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-950 tabular-nums focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div>
                <label htmlFor="qm-monthly" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Kuota Bulanan Opsional (Kosongkan jika pakai batas harian)
                </label>
                <input
                  id="qm-monthly"
                  type="number"
                  min={0}
                  value={quotaModal.monthlyLimit}
                  onChange={(e) => setQuotaModal((prev) => (prev ? { ...prev, monthlyLimit: e.target.value } : null))}
                  placeholder="Misal: 25000"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-950 tabular-nums focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuotaModal(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={busyAction === quotaModal.user.uid}
                  className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                >
                  Simpan Kuota
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
