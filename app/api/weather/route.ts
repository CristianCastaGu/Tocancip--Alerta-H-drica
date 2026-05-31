import { NextResponse } from 'next/server';
import { fetchOpenMeteo } from '@/lib/weather/openmeteo';
import { fetchOpenWeather } from '@/lib/weather/openweather';
import { fetchWeatherAPI } from '@/lib/weather/weatherapi';
import { fetchMeteoblue } from '@/lib/weather/meteoblue';
import { WeatherData, WeatherSource } from '@/lib/types';
import prisma from '@/lib/prisma';

const CACHE_TTL_MS = 10 * 60 * 1000;

async function getFromCache(source: WeatherSource) {
  const cached = await prisma.weatherCache.findFirst({
    where: { source },
    orderBy: { fetchedAt: 'desc' },
  });
  if (!cached) return null;
  const age = Date.now() - new Date(cached.fetchedAt).getTime();
  if (age > CACHE_TTL_MS) return null;
  return cached.data;
}

async function saveToCache(source: WeatherSource, data: unknown) {
  await prisma.weatherCache.create({ data: { source, data: data as object } });
  await prisma.weatherCache.deleteMany({
    where: {
      source,
      fetchedAt: { lt: new Date(Date.now() - CACHE_TTL_MS * 2) },
    },
  });
}

const UNAVAILABLE = (source: WeatherSource): WeatherData => ({
  source, temperature: 0, humidity: 0, precipitation: 0,
  windSpeed: 0, rainProbability: 0, timestamp: new Date().toISOString(), available: false,
});

export async function GET() {
  const apiStatus: Record<WeatherSource, { ok: boolean; lastSuccess: string | null }> = {
    'open-meteo': { ok: false, lastSuccess: null },
    openweather:  { ok: false, lastSuccess: null },
    weatherapi:   { ok: false, lastSuccess: null },
    meteoblue:    { ok: false, lastSuccess: null },
  };

  const weatherSources: WeatherData[] = [];
  let hourly: unknown[] = [];
  let daily: unknown[] = [];

  await Promise.allSettled([
    /* Open-Meteo */
    (async () => {
      try {
        const cached = await getFromCache('open-meteo');
        if (cached) {
          const d = cached as unknown as { current: WeatherData; hourly: typeof hourly; daily: typeof daily };
          weatherSources.push(d.current);
          if (d.hourly?.length) hourly = d.hourly;
          if (d.daily?.length) daily = d.daily;
        } else {
          const result = await fetchOpenMeteo();
          weatherSources.push(result.current);
          hourly = result.hourly;
          daily = result.daily;
          await saveToCache('open-meteo', result);
        }
        apiStatus['open-meteo'] = { ok: true, lastSuccess: new Date().toISOString() };
      } catch { weatherSources.push(UNAVAILABLE('open-meteo')); }
    })(),

    /* OpenWeather */
    (async () => {
      try {
        const cached = await getFromCache('openweather');
        if (cached) {
          weatherSources.push((cached as unknown as { current: WeatherData }).current);
        } else {
          const result = await fetchOpenWeather();
          weatherSources.push(result.current);
          await saveToCache('openweather', result);
        }
        apiStatus.openweather = { ok: true, lastSuccess: new Date().toISOString() };
      } catch { weatherSources.push(UNAVAILABLE('openweather')); }
    })(),

    /* WeatherAPI */
    (async () => {
      try {
        const cached = await getFromCache('weatherapi');
        if (cached) {
          weatherSources.push((cached as unknown as { current: WeatherData }).current);
        } else {
          const result = await fetchWeatherAPI();
          weatherSources.push(result.current);
          await saveToCache('weatherapi', result);
        }
        apiStatus.weatherapi = { ok: true, lastSuccess: new Date().toISOString() };
      } catch { weatherSources.push(UNAVAILABLE('weatherapi')); }
    })(),

    /* Meteoblue */
    (async () => {
      try {
        const cached = await getFromCache('meteoblue');
        if (cached) {
          const d = cached as unknown as { current: WeatherData; hourly: typeof hourly; daily: typeof daily };
          weatherSources.push(d.current);
          if (!hourly.length && d.hourly?.length) hourly = d.hourly;
          if (!daily.length && d.daily?.length) daily = d.daily;
        } else {
          const result = await fetchMeteoblue();
          weatherSources.push(result.current);
          if (!hourly.length) hourly = result.hourly;
          if (!daily.length) daily = result.daily;
          await saveToCache('meteoblue', result);
        }
        apiStatus.meteoblue = { ok: true, lastSuccess: new Date().toISOString() };
      } catch { weatherSources.push(UNAVAILABLE('meteoblue')); }
    })(),
  ]);

  return NextResponse.json({ current: weatherSources, hourly, daily, apiStatus });
}
