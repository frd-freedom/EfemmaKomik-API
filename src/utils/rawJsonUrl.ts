export interface ResolvedRawTarget {
  mode: 'internal' | 'external';
  fetchUrl: string;
  internalApiPath: string;
  extractedApiKey: string;
  displayTarget: string;
}

/**
 * Resolves any user-pasted endpoint path or full URL (including ais-dev-*.run.app,
 * ais-pre-*.run.app, relative /api/v1/* paths, or external https:// JSON APIs)
 * into a same-origin fetchable URL that never triggers cross-origin Google 403 redirects.
 */
export function resolveRawTarget(rawInput: string, fallbackApiKey = ''): ResolvedRawTarget | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  const currentOrigin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const currentHost =
    typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : 'localhost';

  const normalizedInput =
    trimmed.startsWith('api/') ? `/${trimmed}` : trimmed;

  let parsed: URL;
  try {
    parsed = normalizedInput.startsWith('/')
      ? new URL(normalizedInput, currentOrigin)
      : new URL(normalizedInput);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const isNusaKomikPath =
    parsed.pathname.startsWith('/api/v1/') || parsed.pathname.startsWith('/api/public/');
  const isSameOrPreviewOrigin =
    host === currentHost ||
    host.startsWith('ais-dev-') ||
    host.startsWith('ais-pre-') ||
    host === 'localhost' ||
    host === '127.0.0.1';

  const queryKey =
    parsed.searchParams.get('apikey')?.trim() ||
    parsed.searchParams.get('api_key')?.trim() ||
    '';
  const effectiveKey = queryKey || fallbackApiKey.trim();

  if (isNusaKomikPath && (normalizedInput.startsWith('/') || isSameOrPreviewOrigin)) {
    const cleanParams = new URLSearchParams(parsed.searchParams);
    cleanParams.delete('apikey');
    cleanParams.delete('api_key');
    const qs = cleanParams.toString();
    const cleanPath = `${parsed.pathname}${qs ? `?${qs}` : ''}`;

    return {
      mode: 'internal',
      fetchUrl: cleanPath,
      internalApiPath: cleanPath,
      extractedApiKey: effectiveKey,
      displayTarget: `${currentOrigin}${cleanPath}`,
    };
  }

  const externalUrl = parsed.toString();
  const proxyPath = `/api/v1/proxy/json?url=${encodeURIComponent(externalUrl)}`;
  return {
    mode: 'external',
    fetchUrl: proxyPath,
    internalApiPath: proxyPath,
    extractedApiKey: effectiveKey,
    displayTarget: externalUrl,
  };
}
