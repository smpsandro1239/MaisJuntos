// Extrai coordenadas de ligações comuns (Google Maps e OpenStreetMap) ou de um
// par "lat,lng". Devolve null se não reconhecer o formato. Permite colar um
// link do mapa em vez de depender só do GPS do telemóvel.
export function parseCoordsFromLink(link: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, // Google Maps: .../@41.55,-8.42,15z
    /[?&]q=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/, // Google Maps: ?q=41.55,-8.42
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/, // Google Maps (place data)
    /#map=\d+(?:\.\d+)?\/(-?\d{1,2}(?:\.\d+)?)\/(-?\d{1,3}(?:\.\d+)?)/, // OpenStreetMap: #map=15/41.55/-8.42
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/, // "41.55, -8.42"
  ];
  for (const pattern of patterns) {
    const match = link.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return { lat, lng };
      }
    }
  }
  return null;
}
