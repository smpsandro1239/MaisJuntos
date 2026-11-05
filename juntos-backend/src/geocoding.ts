// RF-PROPOSE-06 / P1.5: geocoding de propostas sem coordenadas (Worker).
//
// Resolve a morada via Nominatim (OpenStreetMap): gratuito, sem API key, com
// User-Agent identificativo e timeout curto. A falha NUNCA bloqueia a aprovação
// — o POI fica com `geocodingPending: true`. Paridade com src/geocoding.ts.

export interface GeocodeCoords {
  latitude: number;
  longitude: number;
}

export interface GeocodeOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  userAgent?: string;
}

export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
export const DEFAULT_GEOCODE_TIMEOUT_MS = 5000;
export const GEOCODE_USER_AGENT = 'maisjuntos/1.0 (contacto@maisjuntos.pt)';

export function normalizeGeocodeKey(address: string, city: string): string {
  const norm = (value: string) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  return `${norm(address)}|${norm(city)}`;
}

export async function geocodeAddress(
  address: string,
  city: string,
  options: GeocodeOptions = {}
): Promise<GeocodeCoords | null> {
  const query = [address, city].filter((part) => String(part || '').trim()).join(', ');
  if (!query.trim()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_GEOCODE_TIMEOUT_MS);
  try {
    const url = `${NOMINATIM_SEARCH_URL}?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const res = await (options.fetchImpl ?? fetch)(url, {
      headers: {
        'User-Agent': options.userAgent ?? GEOCODE_USER_AGENT,
        'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.5',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const first = Array.isArray(data) ? data[0] : undefined;
    if (!first) return null;

    const latitude = Number.parseFloat(String(first.lat));
    const longitude = Number.parseFloat(String(first.lon));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
