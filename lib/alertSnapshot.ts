import { AlertLevel, RainStats, Thresholds, WeatherData, WeatherResponse, WeatherSource } from './types';
import {
  assessRisk, computeIRI, consensus, evaluateRisk, Consensus, IRIComponent,
  LEVEL_LABELS, LEVEL_ORDER,
} from './riskEngine';

/* Fotografía de las condiciones que se guardan en Alert.weatherData al crear una
   alerta. Los campos planos (precipitation, humidity…) se conservan para que los
   registros antiguos y el mensaje de WhatsApp sigan leyéndose igual. */
export interface AlertSnapshot extends Consensus {
  version: 2;
  iri: number;
  calculatedLevel: AlertLevel;   // nivel que calculó el sistema en ese momento
  thresholdLevel: AlertLevel;    // nivel solo por umbrales
  reason: string;
  thresholds: Thresholds;        // umbrales vigentes al activarse
  components: Pick<IRIComponent, 'key' | 'label' | 'weight' | 'rawValue' | 'points' | 'unit' | 'color'>[];
  sources: Omit<WeatherData, 'timestamp'>[];
  rainStats: RainStats | null;
  waError?: string;              // motivo del fallo de WhatsApp, si lo hubo
}

export function buildSnapshot(weather: WeatherResponse, thresholds: Thresholds): AlertSnapshot | null {
  const avg = consensus(weather.current);
  if (!avg) return null;
  const risk = assessRisk(weather.current, thresholds, weather.rainStats);

  return {
    version: 2,
    ...avg,
    iri: risk.iri.iri,
    calculatedLevel: risk.level,
    thresholdLevel: risk.thresholdLevel,
    reason: risk.reason,
    thresholds,
    components: risk.iri.components.map(({ key, label, weight, rawValue, points, unit, color }) => (
      { key, label, weight, rawValue, points, unit, color }
    )),
    sources: weather.current.map(({ timestamp: _timestamp, ...rest }) => rest),
    rainStats: weather.rainStats ?? null,
  };
}

/* ─── Lectura unificada (registros nuevos y antiguos) ─── */
export interface SnapshotView {
  values: Partial<Consensus>;
  iri: number | null;
  calculatedLevel: AlertLevel | null;
  thresholdLevel: AlertLevel | null;
  components: AlertSnapshot['components'];
  thresholds: Thresholds;
  rainStats: RainStats | null;
  sources: AlertSnapshot['sources'];
  waError: string | null;
  /* true: el registro no guardó el desglose y se reconstruyó con los umbrales de hoy */
  reconstructed: boolean;
  /* registros manuales antiguos guardaban la lectura de una sola API */
  singleSource: WeatherSource | null;
}

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

export function readSnapshot(raw: unknown, currentThresholds: Thresholds): SnapshotView {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<AlertSnapshot> & { source?: WeatherSource };

  const values: Partial<Consensus> = {
    temperature: num(d.temperature),
    humidity: num(d.humidity),
    precipitation: num(d.precipitation),
    windSpeed: num(d.windSpeed),
    rainProbability: num(d.rainProbability),
  };
  const rainStats = d.rainStats ?? null;
  const waError = typeof d.waError === 'string' ? d.waError : null;

  if (d.version === 2 && d.thresholds && Array.isArray(d.components)) {
    return {
      values, rainStats, waError,
      iri: num(d.iri) ?? null,
      calculatedLevel: d.calculatedLevel ?? null,
      thresholdLevel: d.thresholdLevel ?? null,
      components: d.components,
      thresholds: d.thresholds,
      sources: Array.isArray(d.sources) ? d.sources : [],
      reconstructed: false,
      singleSource: null,
    };
  }

  /* Registro anterior al desglose: se recalcula con lo que quedó guardado */
  const hasValues = values.precipitation !== undefined && values.humidity !== undefined;
  const pseudo: WeatherData[] = hasValues ? [{
    source: d.source ?? 'open-meteo',
    temperature: values.temperature ?? 0,
    humidity: values.humidity ?? 0,
    precipitation: values.precipitation ?? 0,
    windSpeed: values.windSpeed ?? 0,
    rainProbability: values.rainProbability ?? 0,
    timestamp: '',
    available: true,
  }] : [];
  const iri = computeIRI(pseudo, currentThresholds, rainStats);
  const thresholdLevel = hasValues ? evaluateRisk(pseudo, currentThresholds) : null;
  const calculatedLevel = !hasValues || !thresholdLevel ? null
    : LEVEL_ORDER[iri.level] > LEVEL_ORDER[thresholdLevel] ? iri.level : thresholdLevel;

  return {
    values, rainStats, waError,
    iri: num(d.iri) ?? (hasValues ? iri.iri : null),
    calculatedLevel,
    thresholdLevel,
    components: iri.components,
    thresholds: currentThresholds,
    sources: [],
    reconstructed: true,
    singleSource: d.source ?? null,
  };
}

/* ─── Explicación en lenguaje llano ─── */
export function explainAlert(view: SnapshotView, level: AlertLevel, triggeredBy: string): string[] {
  const lines: string[] = [];
  const { values: v, thresholds: t } = view;

  const exceeded: string[] = [];
  const check = (value: number | undefined, unit: string, name: string, steps: [number, string][]) => {
    if (value === undefined) return;
    const hit = steps.find(([limit]) => value >= limit);
    if (hit) exceeded.push(`${name} ${value.toFixed(1)} ${unit} supera el umbral de ${hit[1]} (${hit[0]} ${unit})`);
  };
  check(v.precipitation, 'mm/h', 'la lluvia de', [[t.precipEmergencia, 'Emergencia'], [t.precipAlerta, 'Alerta'], [t.precipPreventivo, 'Preventivo']]);
  check(v.windSpeed, 'km/h', 'el viento de', [[t.windEmergencia, 'Emergencia'], [t.windAlerta, 'Alerta'], [t.windPreventivo, 'Preventivo']]);
  if (
    v.humidity !== undefined && v.humidity >= t.humidityPreventivo &&
    ((v.precipitation ?? 0) >= 1 || (v.rainProbability ?? 0) >= 60)
  ) {
    exceeded.push(`la humedad de ${v.humidity.toFixed(0)} % supera ${t.humidityPreventivo} % con lluvia presente o probable`);
  }

  if (exceeded.length) lines.push(`Umbrales superados: ${exceeded.join('; ')}.`);

  if (view.iri !== null) {
    const top = [...view.components].sort((a, b) => b.points - a.points).filter((c) => c.points >= 0.5).slice(0, 3);
    const detail = top.length
      ? ` Lo que más pesó: ${top.map((c) => `${c.label.toLowerCase()} (+${c.points.toFixed(1)})`).join(', ')}.`
      : '';
    lines.push(`El índice de riesgo compuesto marcó ${view.iri}/100.${detail}`);
  }

  if (triggeredBy === 'manual' && view.calculatedLevel) {
    lines.push(
      view.calculatedLevel === level
        ? `Activación manual que coincide con el nivel calculado por el sistema (${LEVEL_LABELS[level]}).`
        : `Activación manual: el operador eligió ${LEVEL_LABELS[level]} mientras el sistema calculaba ${LEVEL_LABELS[view.calculatedLevel]}.`
    );
  } else if (triggeredBy !== 'manual' && !exceeded.length && view.iri !== null) {
    lines.push('Ningún umbral individual se superó: la alerta salió por la suma de factores del índice.');
  }

  if (!lines.length) lines.push('Este registro no guardó las condiciones meteorológicas.');
  return lines;
}
