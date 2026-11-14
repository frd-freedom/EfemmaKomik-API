import React, { useEffect, useState } from 'react';
import { LogOut, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export function LogoutConfirmModal() {
  const { userProfile, firebaseUser, logoutConfirmOpen, cancelSignOut, confirmSignOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  useBodyScrollLock(logoutConfirmOpen);

  useEffect(() => {
    if (!logoutConfirmOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !signingOut) {
        cancelSignOut();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [logoutConfirmOpen, signingOut, cancelSignOut]);

  if (!logoutConfirmOpen) return null;

  const accountLabel = userProfile?.email || firebaseUser?.email || '';

  const handleConfirm = async () => {
    setSigningOut(true);
    try {
      await confirmSignOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overscroll-none"
      onClick={() => {
        if (!signingOut) cancelSignOut();
      }}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950/70 dark:text-rose-400">
              <LogOut className="h-4 w-4" />
            </div>
            <h2 id="logout-confirm-title" className="font-display text-base font-bold text-slate-950 dark:text-slate-100">
              Yakin mau keluar?
            </h2>
          </div>
          <button
            type="button"
            disabled={signingOut}
            onClick={cancelSignOut}
            aria-label="Batal keluar"
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Sesi akun Anda{accountLabel ? ` (${accountLabel})` : ''} akan diakhiri. Anda perlu masuk kembali untuk mengakses dashboard API Key pribadi.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              disabled={signingOut}
              onClick={cancelSignOut}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void handleConfirm()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-800 disabled:opacity-50 whitespace-nowrap"
            >
              <LogOut className="h-3.5 w-3.5" />
              {signingOut ? 'Keluar...' : 'Ya, Keluar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
