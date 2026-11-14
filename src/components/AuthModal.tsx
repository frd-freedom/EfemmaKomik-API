import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, RefreshCw, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export function AuthModal() {
  const {
    authModalOpen,
    closeAuthModal,
    authError,
    clearAuthError,
    needsEmailVerification,
    firebaseUser,
    signInWithEmail,
    registerWithEmail,
    signInWithGoogle,
    resendVerificationEmail,
    reloadVerificationStatus,
    signOutUser,
  } = useAuth();

  useBodyScrollLock(authModalOpen);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  if (!authModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoNotice(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(displayName, email, password);
        setInfoNotice('Tautan verifikasi email telah dikirim. Periksa kotak masuk Anda.');
      }
    } catch {
      // authError already populated in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setInfoNotice(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
    } catch {
      // authError already populated in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
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
      const verified = await reloadVerificationStatus();
      if (!verified) {
        setInfoNotice('Email belum terverifikasi. Pastikan Anda sudah mengklik tautan di email.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Masuk atau Daftar Akun EfemmaKomik-API"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs overscroll-none"
      onClick={closeAuthModal}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">Autentikasi Akun</p>
            <h2 className="font-display text-lg font-bold text-slate-950 dark:text-slate-100">
              {needsEmailVerification
                ? 'Verifikasi Email Anda'
                : mode === 'login'
                  ? 'Masuk ke EfemmaKomik-API'
                  : 'Daftar Akun Developer'}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Tutup popup login"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-5 space-y-5">
          {needsEmailVerification && firebaseUser ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Kami telah mengirim email verifikasi ke{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">{firebaseUser.email}</span>. Klik tautan verifikasi di kotak masuk Anda untuk mengaktifkan API Key pribadi.
              </p>

              {infoNotice && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {infoNotice}
                </div>
              )}

              {authError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                  {authError}
                </div>
              )}

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleCheckVerified()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${submitting ? 'animate-spin' : ''}`} />
                  Saya Sudah Verifikasi
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleResend()}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Kirim Ulang Email Verifikasi
                </button>
                <button
                  type="button"
                  onClick={() => void signOutUser()}
                  className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 py-1"
                >
                  Gunakan akun lain
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    clearAuthError();
                    setInfoNotice(null);
                  }}
                  className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    mode === 'login'
                      ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    clearAuthError();
                    setInfoNotice(null);
                  }}
                  className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    mode === 'register'
                      ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  Daftar Baru
                </button>
              </div>

              {authError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300">
                  {authError}
                </div>
              )}

              {infoNotice && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {infoNotice}
                </div>
              )}

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
                {mode === 'register' && (
                  <div>
                    <label htmlFor="auth-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Nama Lengkap
                    </label>
                    <div className="relative mt-1">
                      <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="auth-name"
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Nama developer"
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-rose-500"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Alamat Email
                  </label>
                  <div className="relative mt-1">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="auth-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <div className="relative mt-1">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-700 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-rose-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-800 disabled:opacity-50"
                >
                  {submitting
                    ? 'Memproses...'
                    : mode === 'login'
                      ? 'Masuk dengan Email'
                      : 'Daftar & Buat API Key'}
                </button>
              </form>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                <span className="mx-3 shrink-0 text-xs text-slate-400 dark:text-slate-500">atau</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleGoogle()}
                className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
                  />
                </svg>
                Lanjutkan dengan Google
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
