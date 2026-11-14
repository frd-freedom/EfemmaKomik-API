import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Navbar, type ActiveTab } from './components/Navbar';
import { CatalogSection } from './components/CatalogSection';
import { BerwarnaSection } from './components/BerwarnaSection';
import { PerpustakaanSection } from './components/PerpustakaanSection';
import { DocsSection } from './components/DocsSection';
import { PlaygroundSection } from './components/PlaygroundSection';
import { PricingSection } from './components/PricingSection';
import { UserDashboard } from './components/UserDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { LogoutConfirmModal } from './components/LogoutConfirmModal';

function AppShell() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('katalog');

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-150">
      <Navbar activeTab={activeTab} onSelectTab={handleSelectTab} />
      <AuthModal />
      <LogoutConfirmModal />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-9 lg:px-8">
        {activeTab === 'katalog' && <CatalogSection onNavigate={handleSelectTab} />}
        {activeTab === 'berwarna' && <BerwarnaSection />}
        {activeTab === 'perpustakaan' && <PerpustakaanSection />}
        {activeTab === 'dokumentasi' && <DocsSection />}
        {activeTab === 'playground' && <PlaygroundSection />}
        {activeTab === 'pricing' && <PricingSection onNavigate={handleSelectTab} />}
        {activeTab === 'apikey' && <UserDashboard onNavigate={handleSelectTab} />}
        {activeTab === 'admin' && <AdminDashboard />}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-6 text-xs text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p className="font-medium text-slate-600 dark:text-slate-300">
            EfemmaKomik-API — REST API Manga, Manhwa &amp; Manhua Bahasa Indonesia.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="button" onClick={() => handleSelectTab('katalog')} className="hover:text-slate-900 dark:hover:text-white">
              Katalog
            </button>
            <button type="button" onClick={() => handleSelectTab('berwarna')} className="hover:text-slate-900 dark:hover:text-white">
              Berwarna
            </button>
            <button type="button" onClick={() => handleSelectTab('perpustakaan')} className="hover:text-slate-900 dark:hover:text-white">
              Perpustakaan
            </button>
            <button type="button" onClick={() => handleSelectTab('dokumentasi')} className="hover:text-slate-900 dark:hover:text-white">
              Dokumentasi
            </button>
            <button type="button" onClick={() => handleSelectTab('playground')} className="hover:text-slate-900 dark:hover:text-white">
              API Console
            </button>
            <button type="button" onClick={() => handleSelectTab('pricing')} className="hover:text-slate-900 dark:hover:text-white">
              Pricing
            </button>
            <button type="button" onClick={() => handleSelectTab('apikey')} className="hover:text-slate-900 dark:hover:text-white">
              API Key
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
