import { Hono } from 'hono';
import type { AppEnv } from '../security';
import { getAppState, getDb, setAppState } from '../db/index';

const routes = new Hono<AppEnv>();

// Whitelist de cidades (evita chaves de cache ilimitadas / abuso do endpoint).
const CITY_COORDS: Record<string, { lat: number; lng: number; name: string }> = {
  'Braga, Centro': { lat: 41.5518, lng: -8.4229, name: 'Braga' },
  'Porto, Baixa': { lat: 41.1496, lng: -8.6109, name: 'Porto' },
  'Guimarães, Histórico': { lat: 41.4425, lng: -8.2918, name: 'Guimarães' },
  'Famalicão, Centro': { lat: 41.4079, lng: -8.5197, name: 'Vila Nova de Famalicão' },
  'Lisboa, Centro': { lat: 38.7223, lng: -9.1393, name: 'Lisboa' },
  'Coimbra, Baixa': { lat: 40.2056, lng: -8.4196, name: 'Coimbra' },
};

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  conditionLabel: string;
  isRain: boolean;
  description: string;
  city: string;
}

interface CachedWeather {
  data: WeatherData;
  ts: number;
}

function interpret(code: number, precip: number): { isRain: boolean; conditionLabel: string; description: string } {
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
  return { isRain, conditionLabel, description };
}

async function fetchOpenMeteo(coords: { lat: number; lng: number; name: string }): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&current=temperature_2m,weather_code,precipitation&timezone=Europe%2FLisbon`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = (await res.json()) as {
    current: { temperature_2m?: number; weather_code?: number; precipitation?: number };
  };
  const temp = Math.round(data.current.temperature_2m ?? 19);
  const code = data.current.weather_code ?? 0;
  const precip = data.current.precipitation ?? 0;
  const { isRain, conditionLabel, description } = interpret(code, precip);
  return { temperature: temp, weatherCode: code, conditionLabel, isRain, description, city: coords.name };
}

// GET /api/weather?city=<chave> (Público)
// Cache em app_state (Turso) com TTL de 15 min — reduz tráfego para a Open-Meteo
// quando vários utilizadores abrem a app na mesma janela temporal.
routes.get('/weather', async (c) => {
  const cityKey = c.req.query('city') || 'Braga, Centro';
  const coords = CITY_COORDS[cityKey];
  if (!coords) {
    return c.json({ error: 'Cidade não suportada.' }, 400);
  }

  const db = getDb(c.env);
  const cacheKey = `weather:${cityKey}`;

  try {
    const cached = await getAppState<CachedWeather | null>(db, cacheKey, null);
    if (cached && cached.ts && Date.now() - cached.ts < CACHE_TTL_MS && cached.data) {
      c.header('X-Weather-Cache', 'HIT');
      return c.json(cached.data);
    }
  } catch {
    // cache indisponível — segue para a chamada externa
  }

  try {
    const fresh = await fetchOpenMeteo(coords);
    c.executionCtx.waitUntil(
      setAppState(db, cacheKey, { data: fresh, ts: Date.now() } satisfies CachedWeather).catch(() => undefined)
    );
    c.header('X-Weather-Cache', 'MISS');
    return c.json(fresh);
  } catch {
    // Risco aceite (documentado): dados sazonais de reserva, sempre com o
    // mesmo formato que a app espera.
    c.header('X-Weather-Cache', 'FALLBACK');
    return c.json({
      temperature: 19,
      weatherCode: 61,
      conditionLabel: 'Chuva leve',
      isRain: true,
      description: 'Aguaceiros fracos a partir da tarde • Ideal para espaços interiores',
      city: coords.name,
    } satisfies WeatherData);
  }
});

export default routes;
