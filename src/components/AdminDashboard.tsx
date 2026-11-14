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
import { Check, Copy, RefreshCw, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { generateApiKey, useAuth } from '../contexts/AuthContext';
import { OperationType, db, handleFirestoreError } from '../lib/firebase';
import { SelectDropdown } from './SelectDropdown';
import type { ApiAccessLog, CacheStats, ServerKeyUsage, UserPlan, UserProfile, UserRole } from '../types';

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
    requestsToday: item.requestsToday,
    requestsTotal: item.requestsTotal,
    status: item.status,
    lastLoginAt: item.lastUsedAt || undefined,
  };
}

export function AdminDashboard() {
  const { firebaseUser, userProfile, getIdToken } = useAuth();
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
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

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
    for (const u of firestoreUsers) byUid.set(u.uid, u);
    for (const u of backendUsers) {
      if (!byUid.has(u.uid)) byUid.set(u.uid, u);
    }
    return Array.from(byUid.values());
  })();

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-rose-700" />
        <h1 className="mt-3 font-display text-xl font-bold text-slate-900">Akses Terbatas Admin</h1>
        <p className="mt-2 text-sm text-slate-600">
          Halaman ini hanya dapat diakses oleh akun administrator yang terverifikasi.
        </p>
      </div>
    );
  }

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const patchBackendUser = async (uid: string, payload: Record<string, unknown>) => {
    const token = await getIdToken();
    if (!token) return;
    await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  };

  const handlePlanChange = async (user: UserProfile, nextPlan: UserPlan) => {
    const nextLimit = nextPlan === 'admin_unlimited' ? -1 : nextPlan === 'pro' ? 10000 : 1000;
    const nextRole: UserRole = nextPlan === 'admin_unlimited' ? 'admin' : user.role;
    setBusyAction(user.uid);
    try {
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
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleRole = async (user: UserProfile) => {
    if (user.uid === userProfile.uid) return;
    const nextRole: UserRole = user.role === 'admin' ? 'user' : 'admin';
    const nextPlan: UserPlan = nextRole === 'admin' ? 'admin_unlimited' : 'free';
    const nextLimit = nextRole === 'admin' ? -1 : 1000;
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
    if (typeof val === 'object' && val !== null && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
      return (val as { toDate: () => Date }).toDate().toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return '-';
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 sm:pb-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Dashboard Admin & Manajemen Database Pengguna
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Pantau seluruh pengguna dari Firestore, atur kuota API Key, dan kendalikan sistem caching server.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchBackendMetrics()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Metrik
          </button>
          <button
            type="button"
            onClick={() => void handleRefreshCatalog()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Sinkronisasi Katalog
          </button>
          <button
            type="button"
            onClick={() => void handleFlushCache()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Flush Cache
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800">
          {notice}
        </div>
      )}

      {/* Server Cache & User KPIs */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs text-slate-500">Total User Database</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-950 tabular-nums sm:text-2xl">
            {users.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {users.filter((u) => u.status === 'active').length} aktif · {users.filter((u) => u.role === 'admin').length} admin
          </p>
        </div>
        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs text-slate-500">Cache Hit Ratio</p>
          <p className="mt-1 font-display text-xl font-bold text-emerald-700 tabular-nums sm:text-2xl">
            {cacheStats?.hitRatePercent ?? 100}%
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {cacheStats?.hits ?? 0} hit · {cacheStats?.staleServes ?? 0} SWR · {cacheStats?.misses ?? 0} miss
          </p>
        </div>
        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs text-slate-500">Entri Cache L1</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-950 tabular-nums sm:text-2xl">
            {cacheStats?.entries ?? 0} / {cacheStats?.maxEntries ?? 500}
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {cacheStats?.coalescedSaves ?? 0} request duplikat digabung
          </p>
        </div>
        <div className="bg-white p-4 sm:p-5">
          <p className="text-xs text-slate-500">Rata-rata Latensi</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-950 tabular-nums sm:text-2xl">
            {cacheStats?.avgResponseMs ?? 0.4} ms
          </p>
          <p className="mt-1 text-xs text-slate-500">cURL Anti-403 aktif</p>
        </div>
      </div>

      {/* All Database Users Table */}
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="font-display text-lg font-bold text-slate-900">
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
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none sm:w-56"
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

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Paket / Kuota</th>
                <th className="px-4 py-3">API Key</th>
                <th className="px-4 py-3 text-right">Hit Hari Ini / Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Login Terakhir</th>
                <th className="px-4 py-3 text-right">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loadingUsers ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Memuat seluruh pengguna dari Firestore...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada user yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const serverUsage = usageMap[u.uid];
                  const todayHits = serverUsage?.requestsToday ?? u.requestsToday ?? 0;
                  const totalHits = serverUsage?.requestsTotal ?? u.requestsTotal ?? 0;
                  const isSelf = u.uid === userProfile.uid;

                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {u.photoURL ? (
                            <img
                              src={u.photoURL}
                              alt={u.displayName}
                              referrerPolicy="no-referrer"
                              className="h-7 w-7 rounded-full border border-slate-200 object-cover shrink-0"
                            />
                          ) : (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white shrink-0">
                              {u.displayName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate max-w-[160px]">{u.displayName}</p>
                            <p className="text-[11px] text-slate-500 truncate max-w-[180px]">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={u.role === 'admin' ? 'font-semibold text-rose-700' : 'text-slate-700'}>
                          {u.role}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <SelectDropdown
                          ariaLabel={`Ubah paket ${u.displayName}`}
                          disabled={busyAction === u.uid || isSelf}
                          value={u.plan}
                          onChange={(next) => void handlePlanChange(u, next as UserPlan)}
                          portal
                          className="w-36"
                          buttonClassName="py-1"
                          options={[
                            { value: 'free', label: 'Free (1.000/hr)' },
                            { value: 'pro', label: 'Pro (10.000/hr)' },
                            { value: 'admin_unlimited', label: 'Unlimited' },
                          ]}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <code className="font-mono text-[11px] text-slate-800">
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
                            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          >
                            {copiedUid === u.uid ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                        {todayHits.toLocaleString('id-ID')} / {totalHits.toLocaleString('id-ID')}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={
                            u.status === 'active' ? 'font-medium text-emerald-700' : 'font-medium text-rose-700'
                          }
                        >
                          {u.status === 'active' ? 'Aktif' : 'Suspended'}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDate(u.lastLoginAt)}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={busyAction === u.uid}
                            onClick={() => void handleRegenerateUserKey(u)}
                            className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          >
                            Reset Key
                          </button>
                          {!isSelf && (
                            <>
                              <button
                                type="button"
                                disabled={busyAction === u.uid}
                                onClick={() => void handleToggleRole(u)}
                                className="rounded border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                              >
                                {u.role === 'admin' ? 'Jadikan User' : 'Jadikan Admin'}
                              </button>
                              <button
                                type="button"
                                disabled={busyAction === u.uid}
                                onClick={() => void handleToggleStatus(u)}
                                className={`rounded border px-2 py-1 text-[11px] font-medium disabled:opacity-40 ${
                                  u.status === 'active'
                                    ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                                    : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
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
        <h2 className="font-display text-lg font-bold text-slate-900">
          Log Request API Terbaru (cURL & Klien)
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th className="px-4 py-2.5">Waktu</th>
                <th className="px-4 py-2.5">Endpoint</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Cache</th>
                <th className="px-4 py-2.5">User-Agent</th>
                <th className="px-4 py-2.5 text-right">Latensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center font-sans text-xs text-slate-500">
                    Belum ada request ke endpoint `/api/v1/komik/*` pada sesi server ini.
                  </td>
                </tr>
              ) : (
                logs.slice(0, 15).map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 text-slate-500 tabular-nums whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString('id-ID')}
                    </td>
                    <td className="px-4 py-2 text-slate-900 max-w-xs truncate">{log.endpoint}</td>
                    <td
                      className={`px-4 py-2 font-semibold tabular-nums ${
                        log.statusCode === 200 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {log.statusCode}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{log.cacheStatus}</td>
                    <td className="px-4 py-2 text-slate-500 max-w-[200px] truncate">{log.userAgent}</td>
                    <td className="px-4 py-2 text-right text-slate-700 tabular-nums">{log.latencyMs} ms</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
