import { WeatherData, HourlyForecast, DailyForecast } from '../types';
import { TOCANCIPA_LAT, TOCANCIPA_LON, TOCANCIPA_ASL, BOGOTA_UTC_OFFSET } from '../location';

const LAT = TOCANCIPA_LAT;
const LON = TOCANCIPA_LON;
const ASL = TOCANCIPA_ASL;

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

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Meteoblue HTTP ${response.status}`);

  const raw = await response.json();
  const d1h = raw.data_1h;
  const dday = raw.data_day;

  /* data_1h empieza a las 00:00 del día: hay que ubicar la hora actual de Bogotá,
     no tomar el índice 0 (que sería la medianoche). Formato: 'YYYY-MM-DD HH:00'. */
  const hourKey = new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 13) + ':00';
  const now = Math.max(0, (d1h?.time ?? []).indexOf(hourKey));

  const current: WeatherData = {
    source: 'meteoblue',
    temperature: d1h?.temperature?.[now] ?? 0,
    humidity: d1h?.relativehumidity?.[now] ?? 0,
    precipitation: d1h?.precipitation?.[now] ?? 0,
    windSpeed: d1h?.windspeed?.[now] ?? 0,
    rainProbability: d1h?.precipitation_probability?.[now] ?? 0,
    timestamp: new Date().toISOString(),
    available: true,
  };

  const hourly: HourlyForecast[] = (d1h?.time ?? [])
    .slice(now, now + 48)
    .map((time: string, k: number) => ({
      time: `${time.replace(' ', 'T')}:00${BOGOTA_UTC_OFFSET}`,
      temperature: d1h.temperature?.[now + k] ?? 0,
      precipitation: d1h.precipitation?.[now + k] ?? 0,
      rainProbability: d1h.precipitation_probability?.[now + k] ?? 0,
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
