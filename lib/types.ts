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

export interface WeatherResponse {
  current: WeatherData[];
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  apiStatus: Record<WeatherSource, { ok: boolean; lastSuccess: string | null }>;
}
