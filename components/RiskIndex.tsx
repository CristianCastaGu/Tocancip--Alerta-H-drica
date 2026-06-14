'use client';

import { WeatherData, Thresholds, AlertLevel } from '@/lib/types';
import { LEVEL_COLORS, LEVEL_LABELS } from '@/lib/riskEngine';

interface Component {
  label: string;
  weight: number;
  rawValue: number;
  norm: number; // 0–1
  unit: string;
  color: string;
}

interface IRIResult {
  iri: number;
  level: AlertLevel;
  components: Component[];
}

/* ─── Cálculo IRI (ISO 31000 — metodología ponderada) ─── */
export function computeIRI(sources: WeatherData[], thresholds: Thresholds): IRIResult {
  const available = sources.filter((s) => s.available);
  if (!available.length) return { iri: 0, level: 'INFORMATIVO', components: [] };

  const avg = (key: keyof WeatherData) =>
    available.reduce((s, d) => s + (d[key] as number), 0) / available.length;

  const precip   = avg('precipitation');
  const humidity = avg('humidity');
  const wind     = avg('windSpeed');
  const rainProb = avg('rainProbability');

  /* Normalización 0–1 por variable */
  const pNorm  = Math.min(1, precip / thresholds.precipEmergencia);
  /* Humedad crítica a partir de 70 % (suelo saturado) */
  const hNorm  = Math.min(1, Math.max(0, (humidity - 70) / 30));
  const vNorm  = Math.min(1, wind / thresholds.windEmergencia);
  const llNorm = Math.min(1, rainProb / 100);

  /* Pesos según literatura UNGRD / WMO-No.1199 */
  const iri = Math.min(100, Math.round(
    pNorm  * 35 +
    hNorm  * 25 +
    vNorm  * 20 +
    llNorm * 20
  ));

  const level: AlertLevel =
    iri >= 75 ? 'EMERGENCIA' :
    iri >= 50 ? 'ALERTA'     :
    iri >= 25 ? 'PREVENTIVO' : 'INFORMATIVO';

  const components: Component[] = [
    { label: 'Precipitación',    weight: 35, rawValue: precip,   norm: pNorm,  unit: 'mm/h', color: '#60a5fa' },
    { label: 'Humedad relativa', weight: 25, rawValue: humidity, norm: hNorm,  unit: '%',    color: '#22d3ee' },
    { label: 'Vel. viento',      weight: 20, rawValue: wind,     norm: vNorm,  unit: 'km/h', color: '#a78bfa' },
    { label: 'Prob. de lluvia',  weight: 20, rawValue: rainProb, norm: llNorm, unit: '%',    color: '#34d399' },
  ];

  return { iri, level, components };
}

/* ─── Componente visual ─── */
interface Props {
  sources: WeatherData[];
  thresholds: Thresholds;
}

export default function RiskIndex({ sources, thresholds }: Props) {
  const { iri, level, components } = computeIRI(sources, thresholds);
  const color = LEVEL_COLORS[level];

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--tw-secondary)' }}>
            Índice de Riesgo Compuesto (IRI)
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--tw-secondary)', opacity: 0.7 }}>
            Fórmula ponderada — ISO 31000 / UNGRD
          </p>
        </div>
        {/* Score circular */}
        <div className="flex flex-col items-center">
          <div
            className="w-16 h-16 rounded-full flex flex-col items-center justify-center border-4"
            style={{ borderColor: color, background: `${color}12` }}
          >
            <span className="text-xl font-bold font-mono leading-none" style={{ color }}>{iri}</span>
            <span className="text-[9px] uppercase tracking-wide" style={{ color }}>/ 100</span>
          </div>
          <span className="text-xs font-semibold mt-1" style={{ color }}>{LEVEL_LABELS[level]}</span>
        </div>
      </div>

      {/* Barra global */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--tw-secondary)' }}>
          <span>0 — Informativo</span>
          <span>25 — Preventivo</span>
          <span>50 — Alerta</span>
          <span>75 — Emergencia</span>
        </div>
        <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'var(--tw-elevated)' }}>
          {/* Zonas de color */}
          <div className="absolute inset-0 flex">
            <div style={{ width: '25%', background: '#22c55e20' }} />
            <div style={{ width: '25%', background: '#eab30820' }} />
            <div style={{ width: '25%', background: '#f9731620' }} />
            <div style={{ width: '25%', background: '#ef444420' }} />
          </div>
          {/* Indicador */}
          <div
            className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
            style={{ width: `${iri}%`, background: color, opacity: 0.85 }}
          />
        </div>
      </div>

      {/* Desglose por variable */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tw-secondary)' }}>
          Contribución por variable
        </p>
        {components.map(({ label, weight, rawValue, norm, unit, color: c }) => (
          <div key={label}>
            <div className="flex justify-between items-center mb-0.5">
              <span className="text-xs text-primary">{label}</span>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span style={{ color: 'var(--tw-secondary)' }}>{rawValue.toFixed(1)} {unit}</span>
                <span className="font-semibold" style={{ color: c }}>
                  +{Math.round(norm * weight)} pts
                </span>
                <span style={{ color: 'var(--tw-secondary)', fontSize: 10 }}>
                  (peso {weight}%)
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--tw-elevated)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${norm * 100}%`, background: c }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Nota metodológica */}
      <p className="text-[10px] mt-4 leading-relaxed" style={{ color: 'var(--tw-secondary)', opacity: 0.65 }}>
        IRI = 0,35·Precipitación + 0,25·Humedad + 0,20·Viento + 0,20·Prob. lluvia.
        Cada variable normalizada respecto a umbral de Emergencia (IDEAM).
      </p>
    </div>
  );
}
