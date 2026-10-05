import { WeatherData, DailyForecast } from '../types';
import { TOCANCIPA_LAT, TOCANCIPA_LON } from '../location';

export async function fetchWeatherAPI(): Promise<{ current: WeatherData; daily: DailyForecast[] }> {
  const key = process.env.WEATHERAPI_KEY;
  if (!key) throw new Error('WEATHERAPI_KEY no configurada');

  const response = await fetch(
    `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${TOCANCIPA_LAT},${TOCANCIPA_LON}&days=7&lang=es`,
    { next: { revalidate: 600 } }
  );

  if (!response.ok) throw new Error(`WeatherAPI HTTP ${response.status}`);

  const raw = await response.json();
  const c = raw.current;

  /* Probabilidad de la hora en curso, comparable con las demás fuentes
     (daily_chance_of_rain es la de todo el día y siempre resulta más alta) */
  const nowEpoch = Date.now() / 1000;
  const hours: { time_epoch: number; chance_of_rain?: number }[] = raw.forecast?.forecastday?.[0]?.hour ?? [];
  const thisHour = hours.find((h) => h.time_epoch <= nowEpoch && nowEpoch < h.time_epoch + 3600);

  const current: WeatherData = {
    source: 'weatherapi',
    temperature: c?.temp_c ?? 0,
    humidity: c?.humidity ?? 0,
    precipitation: c?.precip_mm ?? 0,
    windSpeed: c?.wind_kph ?? 0,
    rainProbability: thisHour?.chance_of_rain ?? raw.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain ?? 0,
    timestamp: new Date().toISOString(),
    available: true,
  };

  const daily: DailyForecast[] = (raw.forecast?.forecastday ?? []).map((day: {
    date: string;
    day: { maxtemp_c: number; mintemp_c: number; totalprecip_mm: number };
  }) => ({
    date: day.date,
    tempMax: day.day?.maxtemp_c ?? 0,
    tempMin: day.day?.mintemp_c ?? 0,
    precipSum: day.day?.totalprecip_mm ?? 0,
  }));

  return { current, daily };
}
