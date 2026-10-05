import { WeatherData, AlertLevel, Thresholds, RainStats } from './types';

/* Umbrales por defecto (protocolo de colores adoptado por el Comité).
   Se usan solo como respaldo cuando la BD todavía no tiene una fila Threshold. */
export const DEFAULT_THRESHOLDS: Thresholds = {
  precipPreventivo: 15, precipAlerta: 30, precipEmergencia: 50,
  windPreventivo: 45,   windAlerta: 65,   windEmergencia: 90,
  humidityPreventivo: 85,
};

export type Consensus = Omit<WeatherData, 'source' | 'timestamp' | 'available'>;

/* Media aritmética de las fuentes disponibles */
export function consensus(data: WeatherData[]): Consensus | null {
  const available = data.filter((d) => d.available);
  if (available.length === 0) return null;
  const mean = (key: keyof Consensus) =>
    available.reduce((s, d) => s + d[key], 0) / available.length;
  return {
    temperature: mean('temperature'),
    humidity: mean('humidity'),
    precipitation: mean('precipitation'),
    windSpeed: mean('windSpeed'),
    rainProbability: mean('rainProbability'),
  };
}

/* ─── Nivel por umbrales (reglas deterministas) ─── */
export function evaluateRisk(data: WeatherData[], thresholds: Thresholds): AlertLevel {
  const avg = consensus(data);
  if (!avg) return 'INFORMATIVO';

  if (
    avg.precipitation >= thresholds.precipEmergencia ||
    avg.windSpeed >= thresholds.windEmergencia
  ) return 'EMERGENCIA';

  if (
    avg.precipitation >= thresholds.precipAlerta ||
    avg.windSpeed >= thresholds.windAlerta
  ) return 'ALERTA';

  /* La humedad alta sola no es señal de riesgo: en la Sabana supera 85 % casi
     todas las noches. Solo cuenta si además está lloviendo o es probable que llueva. */
  const humidSignal =
    avg.humidity >= thresholds.humidityPreventivo &&
    (avg.precipitation >= 1 || avg.rainProbability >= 60);

  if (
    avg.precipitation >= thresholds.precipPreventivo ||
    avg.windSpeed >= thresholds.windPreventivo ||
    humidSignal
  ) return 'PREVENTIVO';

  return 'INFORMATIVO';
}

/* ─── IRI — Índice de Riesgo Compuesto ───────────────────────────────────
   Índice ponderado propio (0–100), en el marco de valoración del riesgo de
   ISO 31000. Los pesos y valores de referencia son una calibración inicial
   y deben ajustarse con registros históricos de eventos en Tocancipá.

   Cada variable se normaliza a 0–1:
     · Intensidad de lluvia   → respecto al umbral de Emergencia
     · Lluvia acumulada 72 h  → saturación del suelo (lluvia antecedente)
     · Lluvia prevista 24 h   → lo que falta por caer
     · Humedad relativa       → de 50 % (0) a 95 % (1)
     · Prob. de lluvia        → 0–100 %
     · Viento                 → respecto al umbral de Emergencia
──────────────────────────────────────────────────────────────────────── */
export const IRI_REFERENCE = {
  past72hMm: 60,     // lluvia en 72 h que se considera suelo saturado
  next24hMm: 50,     // lluvia prevista en 24 h que se considera extrema
  humidityMin: 50,
  humidityMax: 95,
};

export interface IRIComponent {
  key: 'precip' | 'past72h' | 'next24h' | 'humidity' | 'rainProb' | 'wind';
  label: string;
  weight: number;   // puntos máximos que aporta (los pesos suman 100)
  rawValue: number;
  norm: number;     // 0–1
  points: number;   // norm × weight
  unit: string;
  color: string;
  hint: string;     // contra qué se normaliza
}

export interface IRIResult {
  iri: number;
  level: AlertLevel;
  components: IRIComponent[];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function levelFromIRI(iri: number): AlertLevel {
  return iri >= 75 ? 'EMERGENCIA' : iri >= 50 ? 'ALERTA' : iri >= 25 ? 'PREVENTIVO' : 'INFORMATIVO';
}

export function computeIRI(
  sources: WeatherData[],
  thresholds: Thresholds,
  rainStats?: RainStats | null
): IRIResult {
  const avg = consensus(sources);
  if (!avg) return { iri: 0, level: 'INFORMATIVO', components: [] };

  const R = IRI_REFERENCE;
  const base: Omit<IRIComponent, 'points'>[] = [
    {
      key: 'precip', label: 'Intensidad de lluvia', weight: 30, unit: 'mm/h', color: '#60a5fa',
      rawValue: avg.precipitation,
      norm: clamp01(avg.precipitation / thresholds.precipEmergencia),
      hint: `100 % a ${thresholds.precipEmergencia} mm/h`,
    },
    ...(rainStats ? [
      {
        key: 'past72h' as const, label: 'Lluvia acumulada 72 h', weight: 20, unit: 'mm', color: '#818cf8',
        rawValue: rainStats.past72h,
        norm: clamp01(rainStats.past72h / R.past72hMm),
        hint: `100 % a ${R.past72hMm} mm`,
      },
      {
        key: 'next24h' as const, label: 'Lluvia prevista 24 h', weight: 20, unit: 'mm', color: '#38bdf8',
        rawValue: rainStats.next24h,
        norm: clamp01(rainStats.next24h / R.next24hMm),
        hint: `100 % a ${R.next24hMm} mm`,
      },
    ] : []),
    {
      key: 'humidity', label: 'Humedad relativa', weight: 10, unit: '%', color: '#22d3ee',
      rawValue: avg.humidity,
      norm: clamp01((avg.humidity - R.humidityMin) / (R.humidityMax - R.humidityMin)),
      hint: `0 % a ${R.humidityMin} % · 100 % a ${R.humidityMax} %`,
    },
    {
      key: 'rainProb', label: 'Prob. de lluvia', weight: 10, unit: '%', color: '#34d399',
      rawValue: avg.rainProbability,
      norm: clamp01(avg.rainProbability / 100),
      hint: '100 % a 100 %',
    },
    {
      key: 'wind', label: 'Vel. viento', weight: 10, unit: 'km/h', color: '#a78bfa',
      rawValue: avg.windSpeed,
      norm: clamp01(avg.windSpeed / thresholds.windEmergencia),
      hint: `100 % a ${thresholds.windEmergencia} km/h`,
    },
  ];

  /* Si faltan los acumulados (Open-Meteo caído) los pesos se reescalan a 100 */
  const totalWeight = base.reduce((s, c) => s + c.weight, 0);
  const components: IRIComponent[] = base.map((c) => {
    const weight = (c.weight * 100) / totalWeight;
    return { ...c, weight, points: c.norm * weight };
  });

  const iri = Math.min(100, Math.round(components.reduce((s, c) => s + c.points, 0)));
  return { iri, level: levelFromIRI(iri), components };
}

/* ─── Evaluación unificada ───────────────────────────────────────────────
   El nivel vigente es el mayor entre el nivel por umbrales y el nivel del IRI
   (criterio de precaución). La usan el dashboard y el agente automático, para
   que lo que se ve en pantalla sea lo mismo que dispara una alerta. */
export interface RiskAssessment {
  level: AlertLevel;
  thresholdLevel: AlertLevel;
  iri: IRIResult;
  reason: string;
}

export function assessRisk(
  sources: WeatherData[],
  thresholds: Thresholds,
  rainStats?: RainStats | null
): RiskAssessment {
  const thresholdLevel = evaluateRisk(sources, thresholds);
  const iri = computeIRI(sources, thresholds, rainStats);
  const byIri = LEVEL_ORDER[iri.level] > LEVEL_ORDER[thresholdLevel];
  const level = byIri ? iri.level : thresholdLevel;

  const reason =
    level === 'INFORMATIVO' ? 'Ningún umbral superado'
    : byIri ? `IRI ${iri.iri}/100`
    : 'Umbral de lluvia, viento o humedad superado';

  return { level, thresholdLevel, iri, reason };
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
