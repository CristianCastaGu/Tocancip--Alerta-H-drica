'use client';

import { WeatherData, Thresholds, RainStats } from '@/lib/types';
import { computeIRI, LEVEL_COLORS, LEVEL_LABELS } from '@/lib/riskEngine';

interface Props {
  sources: WeatherData[];
  thresholds: Thresholds;
  rainStats?: RainStats | null;
}

/* Un decimal, sin "+0.0" engañoso cuando el aporte es mínimo pero existe */
function formatPoints(points: number): string {
  if (points > 0 && points < 0.05) return '<0,1';
  return points.toFixed(1).replace('.', ',');
}

export default function RiskIndex({ sources, thresholds, rainStats }: Props) {
  const { iri, level, components } = computeIRI(sources, thresholds, rainStats);
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
            Índice ponderado — marco ISO 31000
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
        {components.map(({ key, label, weight, rawValue, norm, points, unit, color: c, hint }) => (
          <div key={key} title={`Escala: ${hint}`}>
            <div className="flex justify-between items-center gap-2 mb-0.5">
              <span className="text-xs text-primary">{label}</span>
              <div className="flex items-center gap-2 text-xs font-mono whitespace-nowrap">
                <span style={{ color: 'var(--tw-secondary)' }}>{rawValue.toFixed(1)} {unit}</span>
                <span className="font-semibold" style={{ color: c }}>
                  +{formatPoints(points)} de {Math.round(weight)}
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
        Cada variable aporta de 0 a su peso máximo; la suma es el IRI.
        {rainStats
          ? ' La lluvia acumulada (72 h) estima la saturación del suelo.'
          : ' Sin datos de lluvia acumulada: los pesos se reescalaron entre las variables disponibles.'}
        {' '}La humedad puntúa entre 50 % y 95 %. Pesos de calibración inicial, pendientes de
        validar con registros históricos locales.
      </p>
    </div>
  );
}
