import { WeatherData, DailyForecast } from '../types';

export async function fetchWeatherAPI(): Promise<{ current: WeatherData; daily: DailyForecast[] }> {
  const key = process.env.WEATHERAPI_KEY;
  if (!key) throw new Error('WEATHERAPI_KEY no configurada');

  const response = await fetch(
    `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=Tocancipa,Colombia&days=7&lang=es`,
    { next: { revalidate: 600 } }
  );

  if (!response.ok) throw new Error(`WeatherAPI HTTP ${response.status}`);

  const raw = await response.json();
  const c = raw.current;

  const current: WeatherData = {
    source: 'weatherapi',
    temperature: c?.temp_c ?? 0,
    humidity: c?.humidity ?? 0,
    precipitation: c?.precip_mm ?? 0,
    windSpeed: c?.wind_kph ?? 0,
    rainProbability: raw.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain ?? 0,
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
