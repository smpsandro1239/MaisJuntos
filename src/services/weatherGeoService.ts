import { API_BASE } from '../config';

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  conditionLabel: string;
  isRain: boolean;
  description: string;
  city: string;
}

export const PORTUGAL_CITIES_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  'Braga, Centro': { lat: 41.5518, lng: -8.4229, name: 'Braga' },
  'Porto, Baixa': { lat: 41.1496, lng: -8.6109, name: 'Porto' },
  'Guimarães, Histórico': { lat: 41.4425, lng: -8.2918, name: 'Guimarães' },
  'Famalicão, Centro': { lat: 41.4079, lng: -8.5197, name: 'Vila Nova de Famalicão' },
  'Lisboa, Centro': { lat: 38.7223, lng: -9.1393, name: 'Lisboa' },
  'Coimbra, Baixa': { lat: 40.2056, lng: -8.4196, name: 'Coimbra' },
};

export async function fetchLiveWeather(cityKey: string): Promise<WeatherData> {
  const coords = PORTUGAL_CITIES_COORDS[cityKey] || PORTUGAL_CITIES_COORDS['Braga, Centro'];

  // 1.º: backend próprio (cache de 15 min partilhada entre todos os clientes).
  try {
    const res = await fetch(`${API_BASE}/api/weather?city=${encodeURIComponent(cityKey)}`, {
      credentials: 'include',
    });
    if (res.ok) {
      return (await res.json()) as WeatherData;
    }
  } catch {
    // backend indisponível — tenta a Open-Meteo diretamente
  }

  // 2.º: chamada direta à Open-Meteo (fallback).
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,weather_code,precipitation&timezone=Europe%2FLisbon`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.statusText}`);
    const data = (await res.json()) as {
      current: { temperature_2m?: number; weather_code?: number; precipitation?: number };
    };

    const current = data.current;
    const temp = Math.round(current.temperature_2m ?? 19);
    const code = current.weather_code ?? 0;
    const precip = current.precipitation ?? 0;

    // Interpret WMO weather codes: 51,53,55 (Drizzle), 61,63,65 (Rain), 80,81,82 (Showers), 95 (Thunderstorm)
    const isRain = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code) || precip > 0.1;

    let conditionLabel = 'Céu Limpo';
    let description = 'Excelente para atividades ao ar livre e parques';

    if (code === 1 || code === 2 || code === 3) {
      conditionLabel = 'Parcialmente Nublado';
      description = 'Bom tempo para ar livre com casaco leve';
    } else if (isRain) {
      conditionLabel = 'Chuva / Aguaceiros';
      description = 'Recomendado espaços interiores ou planos cobertos ☔';
    }

    return {
      temperature: temp,
      weatherCode: code,
      conditionLabel,
      isRain,
      description,
      city: coords.name,
    };
  } catch (err) {
    console.warn('[Weather] Fallback to seasonal Portuguese weather:', err);
    return {
      temperature: 19,
      weatherCode: 61,
      conditionLabel: 'Chuva leve',
      isRain: true,
      description: 'Aguaceiros fracos a partir da tarde • Ideal para espaços interiores',
      city: coords.name,
    };
  }
}

// Calculate Haversine distance in km between two GPS coordinates
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { distanceKm: number; drivingMinutes: number } {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c * 10) / 10;
  // Approximation: average city/suburb speed ~30 km/h + 2 min buffer
  const drivingMinutes = Math.max(3, Math.round((distanceKm / 35) * 60) + 2);

  return { distanceKm, drivingMinutes };
}
