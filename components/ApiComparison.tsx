'use client';

import { WeatherData } from '@/lib/types';
import { AlertTriangle } from 'lucide-react';

interface Props {
  sources: WeatherData[];
}

const VARIABLES = [
  { key: 'temperature'    as keyof WeatherData, label: 'Temperatura',    unit: '°C',   threshold: 3  },
  { key: 'humidity'       as keyof WeatherData, label: 'Humedad',         unit: '%',    threshold: 10 },
  { key: 'precipitation'  as keyof WeatherData, label: 'Precipitación',   unit: 'mm',   threshold: 5  },
  { key: 'windSpeed'      as keyof WeatherData, label: 'Viento',          unit: 'km/h', threshold: 10 },
  { key: 'rainProbability'as keyof WeatherData, label: 'Prob. lluvia',    unit: '%',    threshold: 20 },
];

const SOURCE_LABELS: Record<string, string> = {
  'open-meteo': 'Open-Meteo',
  openweather:  'OpenWeather',
  weatherapi:   'WeatherAPI',
  meteoblue:    'Meteoblue',
};

export default function ApiComparison({ sources }: Props) {
  function hasDiscrepancy(key: keyof WeatherData, threshold: number): boolean {
    const vals = sources.filter((s) => s.available).map((s) => s[key] as number);
    if (vals.length < 2) return false;
    return Math.max(...vals) - Math.min(...vals) > threshold;
  }

  return (
    <div className="card">
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--tw-secondary)' }}>
        Comparación entre APIs
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--tw-border)' }}>
              <th className="text-left py-2 pr-4 text-xs font-medium" style={{ color: 'var(--tw-secondary)' }}>
                Variable
              </th>
              {sources.map((s) => (
                <th key={s.source} className="text-right py-2 px-3 text-xs font-medium whitespace-nowrap"
                  style={{ color: 'var(--tw-secondary)' }}>
                  {SOURCE_LABELS[s.source] ?? s.source}
                  {!s.available && <span className="ml-1 text-red-400">(sin datos)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VARIABLES.map(({ key, label, unit, threshold }) => {
              const disc = hasDiscrepancy(key, threshold);
              return (
                <tr key={key}
                  className="transition-colors"
                  style={{
                    borderBottom: '1px solid var(--tw-border)',
                    background: disc ? 'rgba(234,179,8,0.05)' : 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = disc ? 'rgba(234,179,8,0.08)' : 'var(--tw-table-row)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = disc ? 'rgba(234,179,8,0.05)' : 'transparent')}
                >
                  <td className="py-2 pr-4 text-primary">
                    <span className="flex items-center gap-1.5">
                      {disc && <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                      {label}
                    </span>
                  </td>
                  {sources.map((s) => (
                    <td key={s.source}
                      className="py-2 px-3 text-right font-mono text-xs"
                      style={{ color: !s.available ? 'var(--tw-secondary)' : disc ? '#facc15' : 'var(--tw-primary)' }}>
                      {s.available ? `${(s[key] as number).toFixed(1)} ${unit}` : '—'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-3 flex items-center gap-1" style={{ color: 'var(--tw-secondary)' }}>
        <AlertTriangle className="w-3 h-3 text-yellow-400" />
        Celdas resaltadas indican discrepancias significativas entre fuentes.
      </p>
    </div>
  );
}
