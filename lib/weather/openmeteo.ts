import { WeatherData, HourlyForecast, DailyForecast } from '../types';

const BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const LAT = 4.9667;
const LON = -73.9167;

export interface OpenMeteoResult {
  current: WeatherData;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

export async function fetchOpenMeteo(): Promise<OpenMeteoResult> {
  const params = new URLSearchParams({
    latitude: String(LAT),
    longitude: String(LON),
    current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code',
    hourly: 'temperature_2m,precipitation_probability,precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone: 'America/Bogota',
    forecast_days: '7',
  });

  const response = await fetch(`${BASE_URL}?${params}`, {
    next: { revalidate: 600 },
  });

  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);

  const raw = await response.json();
  const c = raw.current;

  const current: WeatherData = {
    source: 'open-meteo',
    temperature: c.temperature_2m ?? 0,
    humidity: c.relative_humidity_2m ?? 0,
    precipitation: c.precipitation ?? 0,
    windSpeed: c.wind_speed_10m ?? 0,
    rainProbability: 0,
    timestamp: new Date().toISOString(),
    available: true,
  };

  const hourly: HourlyForecast[] = (raw.hourly?.time ?? [])
    .slice(0, 24)
    .map((time: string, i: number) => ({
      time,
      temperature: raw.hourly.temperature_2m[i] ?? 0,
      precipitation: raw.hourly.precipitation[i] ?? 0,
      rainProbability: raw.hourly.precipitation_probability[i] ?? 0,
    }));

  const daily: DailyForecast[] = (raw.daily?.time ?? []).map((date: string, i: number) => ({
    date,
    tempMax: raw.daily.temperature_2m_max[i] ?? 0,
    tempMin: raw.daily.temperature_2m_min[i] ?? 0,
    precipSum: raw.daily.precipitation_sum[i] ?? 0,
  }));

  return { current, hourly, daily };
}
