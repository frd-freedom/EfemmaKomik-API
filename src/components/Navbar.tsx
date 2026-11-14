import React from 'react';
import { LogOut, Moon, Sun, Terminal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export type ActiveTab =
  | 'katalog'
  | 'berwarna'
  | 'perpustakaan'
  | 'dokumentasi'
  | 'playground'
  | 'pricing'
  | 'apikey'
  | 'admin';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export function Navbar({ activeTab, onSelectTab }: NavbarProps) {
  const { userProfile, openAuthModal, requestSignOut, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = userProfile?.role === 'admin';

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'katalog', label: 'Katalog' },
    { id: 'berwarna', label: 'Berwarna' },
    { id: 'perpustakaan', label: 'Perpustakaan' },
    { id: 'dokumentasi', label: 'Dokumentasi' },
    { id: 'playground', label: 'API Console' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'apikey', label: 'API Key' },
  ];

  if (isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin' });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:gap-8 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('katalog')}
          className="inline-flex items-center gap-2 font-display text-base font-bold tracking-tight text-slate-950 dark:text-white whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-700 sm:text-lg"
        >
          <Terminal className="h-4 w-4 text-rose-700 dark:text-rose-500 shrink-0" aria-hidden="true" />
          <span>EfemmaKomik-API</span>
        </button>

        {/* Zone 2: Desktop single-line navigation links */}
        <nav
          aria-label="Navigasi utama"
          className="hidden md:flex items-center gap-4 lg:gap-6 text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-700 ${
                  isActive
                    ? 'font-semibold text-slate-950 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-rose-700 dark:bg-rose-500"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme Toggle + Account Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-950 dark:hover:text-white shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>

          {loading ? (
            <div className="h-9 w-24 rounded-lg bg-slate-100 dark:bg-slate-800" />
          ) : userProfile ? (
            <button
              type="button"
              onClick={requestSignOut}
              title={`Keluar (${userProfile.email})`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700 sm:px-3.5"
            >
              <span className="max-w-[92px] truncate sm:max-w-[120px]">{userProfile.displayName}</span>
              <LogOut className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 dark:bg-rose-600 px-4 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:hover:bg-rose-700 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
            >
              Masuk
            </button>
          )}
        </div>
      </div>

      {/* Mobile Horizontal Navigation Strip */}
      <nav
        aria-label="Navigasi seluler"
        className="flex md:hidden items-center gap-5 overflow-x-auto no-scrollbar border-t border-slate-100 dark:border-slate-800/80 px-4 py-2 text-xs font-medium"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectTab(item.id)}
              className={`relative py-1 whitespace-nowrap shrink-0 transition-colors ${
                isActive ? 'font-semibold text-rose-700 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[9px] h-0.5 bg-rose-700 dark:bg-rose-500"
                />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
