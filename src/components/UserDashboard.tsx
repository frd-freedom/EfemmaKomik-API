import React, { useEffect, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, Lock, Mail, RefreshCw, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function UserDashboard() {
  const {
    firebaseUser,
    userProfile,
    liveUsage,
    loading,
    authError,
    needsEmailVerification,
    clearAuthError,
    signInWithEmail,
    registerWithEmail,
    resendVerificationEmail,
    reloadVerificationStatus,
    signInWithGoogle,
    signOutUser,
    regenerateApiKey,
    refreshUsage,
  } = useAuth();

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    if (userProfile) {
      void refreshUsage();
    }
  }, [userProfile, refreshUsage]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-48 rounded-xl bg-slate-200/70 animate-pulse" />
        <div className="h-36 rounded-xl bg-slate-200/70 animate-pulse" />
      </div>
    );
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoNotice(null);
    setSubmitting(true);
    try {
      if (authMode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(displayName, email, password);
        setInfoNotice('Tautan verifikasi email telah dikirim. Periksa kotak masuk Anda.');
      }
    } catch {
      // authError populated in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setInfoNotice(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch {
      // authError populated in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setSubmitting(true);
    try {
      await resendVerificationEmail();
      setInfoNotice('Email verifikasi ulang telah dikirim.');
    } catch {
      // handled
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckVerified = async () => {
    setSubmitting(true);
    try {
      const ok = await reloadVerificationStatus();
      if (!ok) {
        setInfoNotice('Email belum terverifikasi. Pastikan Anda sudah mengklik tautan di email.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!userProfile) {
    if (needsEmailVerification && firebaseUser) {
      return (
        <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5">
          <div>
            <p className="text-xs font-semibold text-rose-700">Verifikasi Email Diperlukan</p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950">
              Aktivasi Akun & API Key Anda
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Kami telah mengirim tautan verifikasi ke{' '}
              <span className="font-semibold text-slate-900">{firebaseUser.email}</span>. Klik tautan tersebut lalu tekan tombol verifikasi di bawah untuk mengaktifkan API Key Anda.
            </p>
          </div>

          {infoNotice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
              {infoNotice}
            </div>
          )}

          {authError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              {authError}
            </div>
          )}

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleCheckVerified()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${submitting ? 'animate-spin' : ''}`} />
              Saya Sudah Verifikasi
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleResendVerification()}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Kirim Ulang Email
            </button>
          </div>

          <button
            type="button"
            onClick={() => void signOutUser()}
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            Keluar & gunakan akun lain
          </button>
        </div>
      );
    }

    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 sm:p-10">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-rose-700">Autentikasi Email & Google OAuth</p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Masuk atau Daftar untuk Mendapatkan API Key Pribadi
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Masuk menggunakan Email & Password atau akun Google Anda. Setiap akun otomatis menerima API Key unik dengan kuota{' '}
              <span className="font-semibold text-slate-900">1.000 request/hari</span> (atau akses{' '}
              <span className="font-semibold text-slate-900">Unlimited</span> untuk Admin).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                clearAuthError();
                setInfoNotice(null);
              }}
              className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                authMode === 'login' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                clearAuthError();
                setInfoNotice(null);
              }}
              className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                authMode === 'register' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Baru
            </button>
          </div>

          {authError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              {authError}
            </div>
          )}

          {infoNotice && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
              {infoNotice}
            </div>
          )}

          <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3.5">
            {authMode === 'register' && (
              <div>
                <label htmlFor="ud-name" className="block text-xs font-semibold text-slate-700">
                  Nama Lengkap
                </label>
                <div className="relative mt-1">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="ud-name"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nama developer"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="ud-email" className="block text-xs font-semibold text-slate-700">
                Alamat Email
              </label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="ud-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="ud-password" className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <div className="relative mt-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="ud-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1 sm:flex-row">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-rose-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-800 disabled:opacity-50"
              >
                {submitting
                  ? 'Memproses...'
                  : authMode === 'login'
                    ? 'Masuk dengan Email'
                    : 'Daftar & Buat API Key'}
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleGoogleLogin()}
                className="inline-flex items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
                  />
                </svg>
                Google OAuth
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-6 text-xs text-slate-600 sm:grid-cols-3">
            <div>
              <p className="font-semibold text-slate-900">Otomatis Terdaftar</p>
              <p className="mt-1">Data profil dan API key tersimpan aman di sistem.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Anti-403 cURL</p>
              <p className="mt-1">Key langsung aktif untuk request CLI, Python, PHP, atau JS.</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Regenerasi Kapan Saja</p>
              <p className="mt-1">Putar ulang API Key Anda dalam satu klik bila diperlukan.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = userProfile.role === 'admin' || userProfile.dailyLimit === -1;
  const requestsToday = liveUsage?.requestsToday ?? userProfile.requestsToday ?? 0;
  const requestsTotal = liveUsage?.requestsTotal ?? userProfile.requestsTotal ?? 0;
  const dailyLimit = isAdmin ? -1 : liveUsage?.dailyLimit ?? userProfile.dailyLimit;
  const maskedKey = `${userProfile.apiKey.slice(0, 10)}••••••••••••••••${userProfile.apiKey.slice(-4)}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const sampleCurl = `curl -H "x-api-key: ${userProfile.apiKey}" "${origin}/api/v1/komik/terupdate"`;

  const handleCopyKey = () => {
    void navigator.clipboard.writeText(userProfile.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleCopyCurl = () => {
    void navigator.clipboard.writeText(sampleCurl);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 1800);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      await regenerateApiKey();
      setConfirmRegen(false);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">
          {userProfile.photoURL ? (
            <img
              src={userProfile.photoURL}
              alt={userProfile.displayName}
              referrerPolicy="no-referrer"
              className="h-12 w-12 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 font-display text-sm font-bold text-white">
              {userProfile.displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-950">{userProfile.displayName}</h1>
            <p className="text-xs text-slate-500">
              {userProfile.email} · Role: <span className="font-semibold text-slate-800">{userProfile.role}</span> · Status:{' '}
              <span className={userProfile.status === 'active' ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                {userProfile.status}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void refreshUsage()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Perbarui Statistik
        </button>
      </div>

      {/* Quota Summary */}
      <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="p-5">
          <p className="text-xs text-slate-500">Paket & Kuota Harian</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-950 tabular-nums">
            {isAdmin ? 'Admin Unlimited' : `${dailyLimit.toLocaleString('id-ID')} req/hari`}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isAdmin ? 'Tanpa batas harian & burst' : `Paket aktif: ${userProfile.plan.toUpperCase()}`}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500">Pemakaian Hari Ini</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-950 tabular-nums">
            {requestsToday.toLocaleString('id-ID')}
            {!isAdmin && (
              <span className="text-sm font-normal text-slate-400">
                {' '}/ {dailyLimit.toLocaleString('id-ID')}
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-slate-500">Reset otomatis pukul 00:00 WIB</p>
        </div>
        <div className="p-5">
          <p className="text-xs text-slate-500">Total Request Keseluruhan</p>
          <p className="mt-1 font-display text-xl font-bold text-slate-950 tabular-nums">
            {requestsTotal.toLocaleString('id-ID')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {liveUsage?.lastUserAgent ? `Terakhir: ${liveUsage.lastUserAgent.slice(0, 28)}` : 'Belum ada hit API'}
          </p>
        </div>
      </div>

      {/* API Key Vault */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-5 w-5 text-rose-700" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">API Key Pribadi</h2>
              <p className="text-xs text-slate-500">
                Jangan bagikan API key Anda di kode frontend publik yang dapat dilihat pengguna lain.
              </p>
            </div>
          </div>

          {!confirmRegen ? (
            <button
              type="button"
              onClick={() => setConfirmRegen(true)}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Regenerasi Key
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={regenerating}
                onClick={() => void handleRegenerate()}
                className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
              >
                {regenerating ? 'Membuat...' : 'Konfirmasi Putar Ulang'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmRegen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Batal
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-900 break-all">
            {revealed ? userProfile.apiKey : maskedKey}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {revealed ? 'Sembunyikan' : 'Tampilkan'}
            </button>
            <button
              type="button"
              onClick={handleCopyKey}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Tersalin' : 'Salin Key'}
            </button>
          </div>
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-700">Uji Cepat Langsung (Tanpa cURL) & cURL Publik</p>
            <div className="flex items-center gap-3">
              <a
                href={`/api/v1/komik/terupdate?apikey=${encodeURIComponent(userProfile.apiKey)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:text-rose-700"
              >
                Buka Raw JSON di Tab Baru
              </a>
              <button
                type="button"
                onClick={handleCopyCurl}
                className="inline-flex items-center gap-1 text-xs font-medium text-rose-700 hover:text-rose-800"
              >
                {copiedCurl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedCurl ? 'Tersalin' : 'Salin cURL'}
              </button>
            </div>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-100">
            {sampleCurl}
          </pre>
        </div>
      </div>
    </div>
  );
}
