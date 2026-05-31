import { WeatherData, HourlyForecast } from '../types';

const LAT = 4.9667;
const LON = -73.9167;

export async function fetchOpenWeather(): Promise<{ current: WeatherData; hourly: HourlyForecast[] }> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) throw new Error('OPENWEATHER_API_KEY no configurada');

  const [currentRes, forecastRes] = await Promise.all([
    fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${key}&units=metric&lang=es`,
      { next: { revalidate: 600 } }
    ),
    fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${LAT}&lon=${LON}&appid=${key}&units=metric&lang=es`,
      { next: { revalidate: 600 } }
    ),
  ]);

  if (!currentRes.ok) throw new Error(`OpenWeather current HTTP ${currentRes.status}`);
  if (!forecastRes.ok) throw new Error(`OpenWeather forecast HTTP ${forecastRes.status}`);

  const c = await currentRes.json();
  const f = await forecastRes.json();

  const current: WeatherData = {
    source: 'openweather',
    temperature: c.main?.temp ?? 0,
    humidity: c.main?.humidity ?? 0,
    precipitation: c.rain?.['1h'] ?? 0,
    windSpeed: (c.wind?.speed ?? 0) * 3.6,
    rainProbability: (c.clouds?.all ?? 0),
    timestamp: new Date().toISOString(),
    available: true,
  };

  const hourly: HourlyForecast[] = (f.list ?? []).slice(0, 8).map((item: {
    dt_txt: string;
    main: { temp: number };
    rain?: { '3h'?: number };
    pop?: number;
  }) => ({
    time: item.dt_txt,
    temperature: item.main?.temp ?? 0,
    precipitation: item.rain?.['3h'] ?? 0,
    rainProbability: (item.pop ?? 0) * 100,
  }));

  return { current, hourly };
}
