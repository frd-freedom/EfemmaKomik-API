import React, { useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { Navbar, type ActiveTab } from './components/Navbar';
import { CatalogSection } from './components/CatalogSection';
import { BerwarnaSection } from './components/BerwarnaSection';
import { PerpustakaanSection } from './components/PerpustakaanSection';
import { DocsSection } from './components/DocsSection';
import { PlaygroundSection } from './components/PlaygroundSection';
import { UserDashboard } from './components/UserDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';

function AppShell() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('katalog');

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />
      <AuthModal />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        {activeTab === 'katalog' && <CatalogSection onNavigate={setActiveTab} />}
        {activeTab === 'berwarna' && <BerwarnaSection />}
        {activeTab === 'perpustakaan' && <PerpustakaanSection />}
        {activeTab === 'dokumentasi' && <DocsSection />}
        {activeTab === 'playground' && <PlaygroundSection />}
        {activeTab === 'apikey' && <UserDashboard />}
        {activeTab === 'admin' && <AdminDashboard />}
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p>NusaKomik API — Penyedia REST API Manga, Manhwa, Manhua & Perpustakaan Komiku.org Bahasa Indonesia.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="button" onClick={() => setActiveTab('berwarna')} className="hover:text-slate-900">
              Komik Berwarna
            </button>
            <button type="button" onClick={() => setActiveTab('perpustakaan')} className="hover:text-slate-900">
              Perpustakaan
            </button>
            <button type="button" onClick={() => setActiveTab('dokumentasi')} className="hover:text-slate-900">
              Dokumentasi JSON
            </button>
            <button type="button" onClick={() => setActiveTab('playground')} className="hover:text-slate-900">
              Ambil JSON Langsung
            </button>
            <button type="button" onClick={() => setActiveTab('apikey')} className="hover:text-slate-900">
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
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
