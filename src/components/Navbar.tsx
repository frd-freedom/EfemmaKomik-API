import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export type ActiveTab =
  | 'katalog'
  | 'berwarna'
  | 'perpustakaan'
  | 'dokumentasi'
  | 'playground'
  | 'apikey'
  | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export function Navbar({ activeTab, onSelectTab }: NavbarProps) {
  const { userProfile, openAuthModal, signOutUser, loading } = useAuth();
  const isAdmin = userProfile?.role === 'admin';

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'katalog', label: 'Katalog' },
    { id: 'berwarna', label: 'Berwarna' },
    { id: 'perpustakaan', label: 'Perpustakaan' },
    { id: 'dokumentasi', label: 'Dokumentasi' },
    { id: 'playground', label: 'Ambil JSON' },
    { id: 'apikey', label: 'API Key' },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin' });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('katalog')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
        >
          NusaKomik
        </button>

        {/* Zone 2: Desktop single-line navigation links */}
        <nav
          aria-label="Navigasi utama"
          className="hidden md:flex items-center gap-6 lg:gap-7 text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-700 ${
                  isActive
                    ? 'text-slate-950 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-rose-700"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          {loading ? (
            <div className="h-9 w-28 rounded-lg bg-slate-100" />
          ) : userProfile ? (
            <button
              type="button"
              onClick={() => void signOutUser()}
              title={`Keluar (${userProfile.email})`}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
            >
              <span className="max-w-[96px] sm:max-w-[120px] truncate">{userProfile.displayName}</span>
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
            </button>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
            >
              Masuk
            </button>
          )}
        </div>
      </div>

      {/* Android / Mobile Horizontal Navigation Strip */}
      <nav
        aria-label="Navigasi seluler"
        className="flex md:hidden items-center gap-5 overflow-x-auto no-scrollbar border-t border-slate-100 px-4 py-2 text-xs font-medium"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative py-1 whitespace-nowrap shrink-0 transition-colors ${
                isActive ? 'text-rose-700 font-semibold' : 'text-slate-600'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[9px] h-0.5 bg-rose-700"
                />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
