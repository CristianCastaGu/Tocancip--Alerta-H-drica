import { fetchOpenMeteo } from './openmeteo';
import { fetchOpenWeather } from './openweather';
import { fetchWeatherAPI } from './weatherapi';
import { fetchMeteoblue } from './meteoblue';
import { WeatherData, WeatherSource, WeatherResponse, HourlyForecast, DailyForecast, RainStats } from '../types';
import prisma from '../prisma';

const CACHE_TTL_MS = 10 * 60 * 1000;

interface SourceResult {
  current: WeatherData;
  hourly?: HourlyForecast[];
  pastHourly?: HourlyForecast[];
  rainStats?: RainStats | null;
  daily?: DailyForecast[];
}

async function getFromCache(source: WeatherSource): Promise<SourceResult | null> {
  const cached = await prisma.weatherCache.findFirst({
    where: { source },
    orderBy: { fetchedAt: 'desc' },
  });
  if (!cached) return null;
  const age = Date.now() - new Date(cached.fetchedAt).getTime();
  if (age > CACHE_TTL_MS) return null;
  return cached.data as unknown as SourceResult;
}

async function saveToCache(source: WeatherSource, data: SourceResult) {
  await prisma.weatherCache.create({ data: { source, data: data as object } });
  await prisma.weatherCache.deleteMany({
    where: {
      source,
      fetchedAt: { lt: new Date(Date.now() - CACHE_TTL_MS * 2) },
    },
  });
}

const unavailable = (source: WeatherSource): WeatherData => ({
  source, temperature: 0, humidity: 0, precipitation: 0,
  windSpeed: 0, rainProbability: 0, timestamp: new Date().toISOString(), available: false,
});

const FETCHERS: Record<WeatherSource, () => Promise<SourceResult>> = {
  'open-meteo': fetchOpenMeteo,
  openweather: fetchOpenWeather,
  weatherapi: fetchWeatherAPI,
  meteoblue: fetchMeteoblue,
};

const SOURCES: WeatherSource[] = ['open-meteo', 'openweather', 'weatherapi', 'meteoblue'];

/* Consulta las 4 fuentes (con caché de 10 min en BD) y las consolida.
   La usan /api/weather y el agente automático, para evaluar los mismos datos. */
export async function collectWeather(): Promise<WeatherResponse> {
  const results = await Promise.all(
    SOURCES.map(async (source): Promise<SourceResult | null> => {
      /* La caché es una optimización: si la BD no responde (p. ej. Neon despertando)
         se consulta la API igual, en vez de dar la fuente por caída. */
      const cached = await getFromCache(source).catch(() => null);
      if (cached) return cached;
      try {
        const fresh = await FETCHERS[source]();
        await saveToCache(source, fresh).catch(() => undefined);
        return fresh;
      } catch (err) {
        console.error(`[weather] ${source} no disponible: ${(err as Error).message}`);
        return null;
      }
    })
  );

  const now = new Date().toISOString();
  const apiStatus = {} as WeatherResponse['apiStatus'];
  SOURCES.forEach((source, i) => {
    apiStatus[source] = { ok: results[i] !== null, lastSuccess: results[i] ? now : null };
  });

  /* Open-Meteo es la fuente principal de series; Meteoblue es el respaldo */
  const om = results[0];
  const mb = results[3];

  return {
    current: SOURCES.map((source, i) => results[i]?.current ?? unavailable(source)),
    hourly: om?.hourly?.length ? om.hourly : mb?.hourly ?? [],
    pastHourly: om?.pastHourly ?? [],
    /* Una entrada de caché anterior a este campo no lo trae: se trata como "sin dato" */
    rainStats: om?.rainStats ?? null,
    daily: om?.daily?.length ? om.daily : mb?.daily ?? [],
    apiStatus,
  };
}
