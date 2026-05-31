import { WeatherData, AlertLevel, Thresholds } from './types';

function average(data: WeatherData[]): Omit<WeatherData, 'source' | 'timestamp' | 'available'> {
  const available = data.filter((d) => d.available);
  if (available.length === 0) {
    return { temperature: 0, humidity: 0, precipitation: 0, windSpeed: 0, rainProbability: 0 };
  }
  return {
    temperature: available.reduce((s, d) => s + d.temperature, 0) / available.length,
    humidity: available.reduce((s, d) => s + d.humidity, 0) / available.length,
    precipitation: available.reduce((s, d) => s + d.precipitation, 0) / available.length,
    windSpeed: available.reduce((s, d) => s + d.windSpeed, 0) / available.length,
    rainProbability: available.reduce((s, d) => s + d.rainProbability, 0) / available.length,
  };
}

export function evaluateRisk(data: WeatherData[], thresholds: Thresholds): AlertLevel {
  const avg = average(data);

  if (
    avg.precipitation >= thresholds.precipEmergencia ||
    avg.windSpeed >= thresholds.windEmergencia
  ) return 'EMERGENCIA';

  if (
    avg.precipitation >= thresholds.precipAlerta ||
    avg.windSpeed >= thresholds.windAlerta
  ) return 'ALERTA';

  if (
    avg.precipitation >= thresholds.precipPreventivo ||
    avg.windSpeed >= thresholds.windPreventivo ||
    avg.humidity >= thresholds.humidityPreventivo
  ) return 'PREVENTIVO';

  return 'INFORMATIVO';
}

export const LEVEL_LABELS: Record<AlertLevel, string> = {
  INFORMATIVO: 'Informativo',
  PREVENTIVO: 'Preventivo',
  ALERTA: 'Alerta',
  EMERGENCIA: 'Emergencia',
};

export const LEVEL_COLORS: Record<AlertLevel, string> = {
  INFORMATIVO: '#22c55e',
  PREVENTIVO: '#eab308',
  ALERTA: '#f97316',
  EMERGENCIA: '#ef4444',
};

export const LEVEL_DESCRIPTIONS: Record<AlertLevel, string> = {
  INFORMATIVO: 'Condiciones normales. Monitoreo de rutina activo.',
  PREVENTIVO: 'Condiciones climáticas a vigilar. Prepare protocolos.',
  ALERTA: 'Riesgo elevado. Active planes de contingencia.',
  EMERGENCIA: 'Riesgo crítico. Active evacuaciones y respuesta inmediata.',
};

export const LEVEL_ORDER: Record<AlertLevel, number> = {
  INFORMATIVO: 0,
  PREVENTIVO: 1,
  ALERTA: 2,
  EMERGENCIA: 3,
};
