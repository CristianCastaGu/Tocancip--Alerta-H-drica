import { WeatherData, HourlyForecast, DailyForecast } from '../types';

const LAT = 4.9667;
const LON = -73.9167;
const ASL = 2585; // altitud Tocancipá en metros

export interface MeteoblueResult {
  current: WeatherData;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

export async function fetchMeteoblue(): Promise<MeteoblueResult> {
  const key = process.env.METEOBLUE_API_KEY;
  if (!key) throw new Error('METEOBLUE_API_KEY no configurada');

  const url =
    `https://my.meteoblue.com/packages/basic-1h_basic-day` +
    `?apikey=${key}&lat=${LAT}&lon=${LON}&asl=${ASL}` +
    `&format=json&tz=America%2FBogota&windspeed=kmh&temperature=C`;

  const response = await fetch(url, { next: { revalidate: 600 } });
  if (!response.ok) throw new Error(`Meteoblue HTTP ${response.status}`);

  const raw = await response.json();
  const d1h = raw.data_1h;
  const dday = raw.data_day;

  const current: WeatherData = {
    source: 'meteoblue',
    temperature: d1h?.temperature?.[0] ?? 0,
    humidity: d1h?.relativehumidity?.[0] ?? 0,
    precipitation: d1h?.precipitation?.[0] ?? 0,
    windSpeed: d1h?.windspeed?.[0] ?? 0,
    rainProbability: d1h?.precipitation_probability?.[0] ?? 0,
    timestamp: new Date().toISOString(),
    available: true,
  };

  const hourly: HourlyForecast[] = (d1h?.time ?? [])
    .slice(0, 24)
    .map((time: string, i: number) => ({
      time,
      temperature: d1h.temperature?.[i] ?? 0,
      precipitation: d1h.precipitation?.[i] ?? 0,
      rainProbability: d1h.precipitation_probability?.[i] ?? 0,
    }));

  const daily: DailyForecast[] = (dday?.time ?? []).map((date: string, i: number) => ({
    date,
    tempMax: dday.temperature_max?.[i] ?? 0,
    tempMin: dday.temperature_min?.[i] ?? 0,
    precipSum: dday.precipitation?.[i] ?? 0,
  }));

  return { current, hourly, daily };
}

export function getMeteogramUrl(apiKey: string): string {
  return (
    `https://my.meteoblue.com/visimage/meteogram` +
    `?lat=${LAT}&lon=${LON}&asl=${ASL}` +
    `&apikey=${apiKey}&language=es&windspeed=kmh&temperature=C&format=png`
  );
}
