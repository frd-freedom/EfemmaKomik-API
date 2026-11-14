import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { SiteSettings } from '../types';

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  freeDailyTokens: 10,
  freePlanName: 'Free',
  freePlanDescription: 'Akses gratis harian untuk mencoba seluruh endpoint REST API.',
  ownerWhatsappNumber: '6281234567890',
  ownerWhatsappName: 'Owner EfemmaKomik-API',
  whatsappMessageTemplate:
    'Halo {owner}, saya ingin membeli paket *{package_name}* ({tokens_per_month} token/bulan - {price}) untuk akun {user_email} (API Key: {api_key}).',
  pricingHeadline: 'Harga & Paket Token Request API',
  pricingSubtitle:
    'Setiap request ke endpoint /api/v1/* menggunakan 1 token. Upgrade ke paket bulanan untuk kuota lebih besar.',
  billingNotice:
    'Pembayaran otomatis sedang dalam tahap integrasi. Pemesanan paket token sementara dilayani langsung melalui WhatsApp Owner.',
  packages: [
    {
      id: 'starter',
      name: 'Starter Token',
      tagline: 'Untuk bot pribadi, riset, & proyek indie',
      tokensPerMonth: 5000,
      priceIdr: 15000,
      billingPeriodLabel: '/bulan',
      features: [
        '5.000 token request / bulan',
        'Akses seluruh endpoint /api/v1/komik/*',
        'Dukungan cURL Anti-403 & JSON 200 OK',
      ],
      highlighted: false,
      active: true,
      ctaLabel: 'Beli via WhatsApp',
    },
    {
      id: 'pro',
      name: 'Pro Developer',
      tagline: 'Untuk website baca komik & aplikasi aktif',
      tokensPerMonth: 25000,
      priceIdr: 49000,
      billingPeriodLabel: '/bulan',
      features: [
        '25.000 token request / bulan',
        'Akses prioritas cache L1 & semua genre',
        'Link Raw JSON & cURL tanpa batasan harian ketat',
      ],
      highlighted: true,
      active: true,
      ctaLabel: 'Beli via WhatsApp',
    },
    {
      id: 'business',
      name: 'Business Scale',
      tagline: 'Untuk trafik tinggi & multi-aplikasi',
      tokensPerMonth: 100000,
      priceIdr: 149000,
      billingPeriodLabel: '/bulan',
      features: [
        '100.000 token request / bulan',
        'Kapasitas tinggi untuk sinkronisasi katalog & reader',
        'Dukungan langsung via WhatsApp Owner',
      ],
      highlighted: false,
      active: true,
      ctaLabel: 'Beli via WhatsApp',
    },
  ],
  updatedAt: '',
};

interface SettingsContextValue {
  settings: SiteSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/public/settings');
      if (res.ok) {
        const json = (await res.json()) as { status: boolean; data?: SiteSettings };
        if (json.status && json.data) {
          setSettings(json.data);
        }
      }
    } catch {
      // Keep defaults on transient network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSettings();
  }, [refreshSettings]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
