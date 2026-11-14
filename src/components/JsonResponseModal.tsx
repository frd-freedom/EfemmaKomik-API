import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, ExternalLink, KeyRound, Lock, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface JsonResponseModalProps {
  apiPath: string;
  title: string;
  onClose: () => void;
}

export function JsonResponseModal({ apiPath, title, onClose }: JsonResponseModalProps) {
  useBodyScrollLock(true);
  const { userProfile, openAuthModal, refreshUsage } = useAuth();
  const [manualKey, setManualKey] = useState('');
  const activeKey = manualKey.trim() || userProfile?.apiKey || '';

  const [loading, setLoading] = useState(Boolean(activeKey));
  const [statusLine, setStatusLine] = useState<string>('');
  const [headersInfo, setHeadersInfo] = useState<Record<string, string>>({});
  const [jsonText, setJsonText] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const fetchEndpoint = async (keyOverride?: string) => {
    const keyToUse = (keyOverride ?? activeKey).trim();
    if (!keyToUse) {
      setLoading(false);
      setStatusLine('401 API Key Diperlukan');
      setHeadersInfo({});
      setJsonText('');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(apiPath, {
        headers: {
          'x-api-key': keyToUse,
          Accept: 'application/json',
        },
      });
      setStatusLine(`${res.status} ${res.statusText}`);
      const captured: Record<string, string> = {};
      for (const h of ['X-Cache', 'X-Response-Time', 'X-RateLimit-Remaining', 'X-Anti403-Status']) {
        const val = res.headers.get(h);
        if (val) captured[h] = val;
      }
      setHeadersInfo(captured);
      const data = await res.json();
      setJsonText(JSON.stringify(data, null, 2));
      if (userProfile) {
        void refreshUsage();
      }
    } catch (err) {
      setStatusLine('Error');
      setJsonText(
        JSON.stringify(
          { status: false, message: err instanceof Error ? err.message : 'Gagal mengambil JSON' },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeKey) {
      void fetchEndpoint(activeKey);
    } else {
      setLoading(false);
      setStatusLine('API Key Diperlukan');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath, userProfile?.apiKey]);

  const rawBrowserUrl = (() => {
    if (!activeKey) return '';
    const sep = apiPath.includes('?') ? '&' : '?';
    return `${apiPath}${sep}apikey=${encodeURIComponent(activeKey)}`;
  })();

  const handleCopy = () => {
    if (!jsonText) return;
    void navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    if (!jsonText) return;
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = apiPath.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'komiku-response';
    a.download = `${safeName}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pengambil Respon JSON Langsung (Tanpa cURL)"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 backdrop-blur-xs overscroll-none"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-rose-700">Ambil Respon JSON Langsung (Tanpa cURL)</p>
            <h2 className="font-display text-base font-bold text-slate-950 truncate sm:text-lg">{title}</h2>
            <p className="mt-0.5 font-mono text-[11px] text-slate-500 truncate sm:text-xs">{apiPath}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal JSON"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs tabular-nums">
            <span className={statusLine.startsWith('200') ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
              {loading ? 'Memuat...' : statusLine || 'Menunggu API Key'}
            </span>
            {Object.entries(headersInfo).map(([k, v]) => (
              <span key={k} className="text-slate-600">
                <span className="text-slate-400">{k}:</span> {v}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void fetchEndpoint()}
              disabled={loading || !activeKey}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Muat Ulang
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={loading || !jsonText}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Tersalin' : 'Salin JSON'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || !jsonText}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download .json
            </button>
            {rawBrowserUrl && (
              <a
                href={rawBrowserUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Buka Raw JSON
              </a>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto overscroll-contain bg-slate-950 p-4 sm:p-5">
          {!activeKey ? (
            <div className="mx-auto my-6 max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 text-slate-100 space-y-4">
              <div className="flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    API Key Pribadi Diperlukan
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">
                    Kunci demo publik telah dihapus. Silakan masuk via Email atau Google OAuth untuk langsung memakai API Key Anda, atau masukkan API Key pribadi di bawah ini.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={manualKey}
                    onChange={(e) => setManualKey(e.target.value)}
                    placeholder="Tempel API Key (kmk_usr_... / kmk_adm_...)"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-9 pr-3 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-rose-600 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={!manualKey.trim()}
                  onClick={() => void fetchEndpoint(manualKey)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40 whitespace-nowrap"
                >
                  Ambil JSON
                </button>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={openAuthModal}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-rose-800"
                >
                  Masuk via Email atau Google
                </button>
              </div>
            </div>
          ) : (
            <pre className="font-mono text-xs leading-relaxed text-slate-100">
              {loading ? '// Mengambil respon JSON langsung dari server Komiku...' : jsonText}
            </pre>
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 sm:px-6">
          {activeKey ? (
            <>
              API Key aktif: <code className="font-mono text-slate-800 break-all">{activeKey}</code>. Tombol <strong>Buka Raw JSON</strong> dan <strong>Download .json</strong> bekerja langsung lewat sesi browser tanpa perlu terminal cURL.
            </>
          ) : (
            'Masuk untuk mengaktifkan pengambilan JSON langsung tanpa cURL.'
          )}
        </div>
      </div>
    </div>
  );
}
