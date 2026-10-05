export type WeatherSource = 'open-meteo' | 'openweather' | 'weatherapi' | 'meteoblue';

export interface WeatherData {
  source: WeatherSource;
  temperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  rainProbability: number;
  timestamp: string;
  available: boolean;
}

export type AlertLevel = 'INFORMATIVO' | 'PREVENTIVO' | 'ALERTA' | 'EMERGENCIA';

export interface Thresholds {
  precipPreventivo: number;
  precipAlerta: number;
  precipEmergencia: number;
  windPreventivo: number;
  windAlerta: number;
  windEmergencia: number;
  humidityPreventivo: number;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  precipitation: number;
  rainProbability: number;
}

export interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  precipSum: number;
}

/* Lluvia acumulada (mm) alrededor del momento actual — fuente Open-Meteo */
export interface RainStats {
  past24h: number;
  past72h: number;
  next6h: number;
  next24h: number;
  maxProbNext6h: number; // %
}

export interface WeatherResponse {
  current: WeatherData[];
  hourly: HourlyForecast[];       // desde la hora actual, hasta 48 h
  pastHourly?: HourlyForecast[];  // 72 h previas a la hora actual
  rainStats?: RainStats | null;
  daily: DailyForecast[];
  apiStatus: Record<WeatherSource, { ok: boolean; lastSuccess: string | null }>;
}
