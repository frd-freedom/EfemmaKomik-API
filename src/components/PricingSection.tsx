import React from 'react';
import { Check, Coins, ExternalLink, Info, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import type { PricingPackage } from '../types';
import type { ActiveTab } from './Navbar';

interface PricingSectionProps {
  onNavigate: (tab: ActiveTab) => void;
}

function normalizeWaPhone(raw: string): string {
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

function formatRupiah(amount: number): string {
  if (amount <= 0) return 'Rp 0';
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export function PricingSection({ onNavigate }: PricingSectionProps) {
  const { userProfile, openAuthModal } = useAuth();
  const { settings } = useSettings();

  const waPhone = normalizeWaPhone(settings.ownerWhatsappNumber);
  const activePackages = settings.packages.filter((p) => p.active);

  const buildWhatsappUrl = (pkg: PricingPackage): string => {
    const formattedPrice = `${formatRupiah(pkg.priceIdr)}${pkg.billingPeriodLabel || '/bulan'}`;
    const msg = (
      settings.whatsappMessageTemplate ||
      'Halo {owner}, saya ingin membeli paket {package_name} ({tokens_per_month} token/bulan - {price}) untuk akun {user_email}.'
    )
      .replace(/\{owner\}/g, settings.ownerWhatsappName || 'Owner')
      .replace(/\{package_name\}/g, pkg.name)
      .replace(/\{tokens_per_month\}/g, pkg.tokensPerMonth.toLocaleString('id-ID'))
      .replace(/\{price\}/g, formattedPrice)
      .replace(/\{user_email\}/g, userProfile?.email || 'Belum login')
      .replace(/\{api_key\}/g, userProfile?.apiKey || '-');

    if (!waPhone) return '#';
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
  };

  const buildGeneralWhatsappUrl = (): string => {
    if (!waPhone) return '#';
    const msg = `Halo ${settings.ownerWhatsappName || 'Owner'}, saya ingin bertanya mengenai pembelian token request EfemmaKomik-API${
      userProfile?.email ? ` (Akun: ${userProfile.email})` : ''
    }.`;
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
  };

  const isFreeUser = !userProfile || (userProfile.role !== 'admin' && userProfile.plan === 'free');

  return (
    <div className="space-y-8">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
        <p className="text-xs font-semibold tracking-wide text-rose-700 dark:text-rose-400">
          EfemmaKomik-API · Token Request &amp; Paket Bulanan
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
          {settings.pricingHeadline}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          {settings.pricingSubtitle}
        </p>
      </div>

      {/* Fallback Checkout Notice */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">Konfirmasi Pembelian: </span>
            {settings.billingNotice}
          </div>
        </div>
        {waPhone && (
          <a
            href={buildGeneralWhatsappUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/50 px-3.5 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/60 whitespace-nowrap shrink-0"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Hubungi {settings.ownerWhatsappName}
          </a>
        )}
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {/* Free Tier Card */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Gratis Bawaan</p>
              <h2 className="mt-1 font-display text-lg font-bold text-slate-950 dark:text-white">
                {settings.freePlanName}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {settings.freePlanDescription}
              </p>
            </div>

            <div className="border-y border-slate-100 dark:border-slate-800 py-4">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                  Rp 0
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">/hari</span>
              </div>
              <p className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-rose-700 dark:text-rose-400 tabular-nums">
                <Coins className="h-3.5 w-3.5" />
                {settings.freeDailyTokens.toLocaleString('id-ID')} token / hari
              </p>
            </div>

            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{settings.freeDailyTokens.toLocaleString('id-ID')} token request setiap hari (reset 00:00 WIB)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>API Key pribadi aktif otomatis setelah daftar</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Mendukung Link Raw JSON &amp; cURL 200 OK</span>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-2">
            {userProfile ? (
              <button
                type="button"
                onClick={() => onNavigate('apikey')}
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {isFreeUser ? 'Paket Aktif Saat Ini' : 'Lihat Kuota API Key'}
              </button>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-900 dark:text-white transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Daftar Gratis
              </button>
            )}
          </div>
        </div>

        {/* Paid Monthly Packages */}
        {activePackages.map((pkg) => {
          const waUrl = buildWhatsappUrl(pkg);
          const isCurrentPkg = userProfile?.packageId === pkg.id && userProfile?.plan === 'pro';

          return (
            <div
              key={pkg.id}
              className={`flex flex-col justify-between rounded-xl border p-5 sm:p-6 ${
                pkg.highlighted
                  ? 'border-rose-700 dark:border-rose-500 bg-white dark:bg-slate-900 ring-1 ring-rose-700/15 dark:ring-rose-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
              }`}
            >
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                      {pkg.highlighted ? 'Rekomendasi' : 'Paket Bulanan'}
                    </p>
                    {isCurrentPkg && (
                      <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Aktif
                      </span>
                    )}
                  </div>
                  <h2 className="mt-1 font-display text-lg font-bold text-slate-950 dark:text-white">
                    {pkg.name}
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {pkg.tagline}
                  </p>
                </div>

                <div className="border-y border-slate-100 dark:border-slate-800 py-4">
                  <div className="flex items-baseline gap-1">
                    <span className="font-display text-2xl font-bold text-slate-950 dark:text-white tabular-nums">
                      {formatRupiah(pkg.priceIdr)}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {pkg.billingPeriodLabel || '/bulan'}
                    </span>
                  </div>
                  <p className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    <Coins className="h-3.5 w-3.5" />
                    {pkg.tokensPerMonth.toLocaleString('id-ID')} token / bulan
                  </p>
                </div>

                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  {pkg.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-2">
                {waPhone ? (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors ${
                      pkg.highlighted
                        ? 'bg-rose-700 text-white hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-700'
                        : 'bg-slate-950 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200'
                    }`}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>{pkg.ctaLabel || 'Beli via WhatsApp'}</span>
                    <ExternalLink className="h-3 w-3 opacity-80" />
                  </a>
                ) : (
                  <span className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                    Nomor WhatsApp belum diatur Admin
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Transparent Comparison Footer */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <h3 className="font-display text-sm font-bold text-slate-950 dark:text-white">
          Cara Kerja Token Request
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-4 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">1. Hit Endpoint /api/v1/*</p>
            <p className="mt-1">Setiap request sukses ke endpoint API v1 memotong 1 token dari kuota akun Anda.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">2. Konfirmasi WhatsApp Owner</p>
            <p className="mt-1">Klik tombol paket pilihan Anda untuk mengirim rincian paket &amp; API Key langsung ke WhatsApp Owner.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">3. Aktivasi Instan oleh Admin</p>
            <p className="mt-1">Setelah konfirmasi pembayaran, Admin mengaktifkan paket token bulanan ke API Key Anda secara real-time.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
