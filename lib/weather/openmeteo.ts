import { WeatherData, HourlyForecast, DailyForecast, RainStats } from '../types';
import { TOCANCIPA_LAT, TOCANCIPA_LON, BOGOTA_UTC_OFFSET } from '../location';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const PAST_HOURS = 72;
const FORECAST_HOURS = 48;

export interface OpenMeteoResult {
  current: WeatherData;
  hourly: HourlyForecast[];
  pastHourly: HourlyForecast[];
  rainStats: RainStats | null;
  daily: DailyForecast[];
}

export async function fetchOpenMeteo(): Promise<OpenMeteoResult> {
  const params = new URLSearchParams({
    latitude: String(TOCANCIPA_LAT),
    longitude: String(TOCANCIPA_LON),
    current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code',
    hourly: 'temperature_2m,precipitation_probability,precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'America/Bogota',
    past_days: '3',
    forecast_days: '7',
  });

  const response = await fetch(`${BASE_URL}?${params}`, {
    next: { revalidate: 600 },
  });

  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);

  const raw = await response.json();
  const c = raw.current;

  const times: string[] = raw.hourly?.time ?? [];
  const precip: (number | null)[] = raw.hourly?.precipitation ?? [];
  const prob: (number | null)[] = raw.hourly?.precipitation_probability ?? [];
  const temp: (number | null)[] = raw.hourly?.temperature_2m ?? [];

  /* Índice de la hora actual dentro de la serie (hora local de Bogotá, sin desfase) */
  const hourKey = typeof c?.time === 'string' ? `${c.time.slice(0, 13)}:00` : '';
  const nowIdx = times.indexOf(hourKey);

  const toPoint = (i: number): HourlyForecast => ({
    time: `${times[i]}:00${BOGOTA_UTC_OFFSET}`,
    temperature: temp[i] ?? 0,
    precipitation: precip[i] ?? 0,
    rainProbability: prob[i] ?? 0,
  });
  const range = (from: number, to: number) => {
    const out: HourlyForecast[] = [];
    for (let i = Math.max(0, from); i < Math.min(times.length, to); i++) out.push(toPoint(i));
    return out;
  };
  const sum = (points: HourlyForecast[]) => points.reduce((s, p) => s + p.precipitation, 0);

  let hourly: HourlyForecast[];
  let pastHourly: HourlyForecast[] = [];
  let rainStats: RainStats | null = null;

  if (nowIdx >= 0) {
    hourly = range(nowIdx, nowIdx + FORECAST_HOURS);
    pastHourly = range(nowIdx - PAST_HOURS, nowIdx);
    const next6 = range(nowIdx, nowIdx + 6);
    rainStats = {
      past24h: sum(range(nowIdx - 24, nowIdx)),
      past72h: sum(pastHourly),
      next6h: sum(next6),
      next24h: sum(range(nowIdx, nowIdx + 24)),
      maxProbNext6h: next6.reduce((m, p) => Math.max(m, p.rainProbability), 0),
    };
  } else {
    hourly = range(0, FORECAST_HOURS);
  }

  const current: WeatherData = {
    source: 'open-meteo',
    temperature: c.temperature_2m ?? 0,
    humidity: c.relative_humidity_2m ?? 0,
    precipitation: c.precipitation ?? 0,
    windSpeed: c.wind_speed_10m ?? 0,
    rainProbability: nowIdx >= 0 ? prob[nowIdx] ?? 0 : 0,
    timestamp: new Date().toISOString(),
    available: true,
  };

  /* La serie diaria incluye los 3 días previos; se muestran solo hoy y los siguientes */
  const today = typeof c?.time === 'string' ? c.time.slice(0, 10) : '';
  const daily: DailyForecast[] = (raw.daily?.time ?? [])
    .map((date: string, i: number) => ({
      date,
      tempMax: raw.daily.temperature_2m_max[i] ?? 0,
      tempMin: raw.daily.temperature_2m_min[i] ?? 0,
      precipSum: raw.daily.precipitation_sum[i] ?? 0,
    }))
    .filter((d: DailyForecast) => !today || d.date >= today);

  return { current, hourly, pastHourly, rainStats, daily };
}
