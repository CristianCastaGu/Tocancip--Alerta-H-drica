'use client';

import { WeatherData } from '@/lib/types';
import { AlertTriangle, Info } from 'lucide-react';

interface Props {
  sources: WeatherData[];
}

/* Exactamente las mismas 5 variables se consultan a cada API */
const VARIABLES: { key: keyof WeatherData; label: string; unit: string; threshold: number; note: string }[] = [
  { key: 'temperature',     label: 'Temperatura',       unit: '°C',   threshold: 3,  note: 'Diferencia >3 °C entre fuentes' },
  { key: 'humidity',        label: 'Humedad relativa',  unit: '%',    threshold: 10, note: 'Diferencia >10 %' },
  { key: 'precipitation',   label: 'Precipitación',     unit: 'mm/h', threshold: 5,  note: 'Diferencia >5 mm/h' },
  { key: 'windSpeed',       label: 'Vel. viento',       unit: 'km/h', threshold: 10, note: 'Diferencia >10 km/h' },
  { key: 'rainProbability', label: 'Prob. de lluvia',   unit: '%',    threshold: 20, note: 'Diferencia >20 %' },
];

const SOURCE_LABELS: Record<string, string> = {
  'open-meteo': 'Open-Meteo',
  openweather:  'OpenWeather',
  weatherapi:   'WeatherAPI',
  meteoblue:    'Meteoblue',
};

export default function ApiComparison({ sources }: Props) {
  const available = sources.filter((s) => s.available);

  function getValues(key: keyof WeatherData) {
    return available.map((s) => s[key] as number);
  }

  function consensus(key: keyof WeatherData): number | null {
    const vals = getValues(key);
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function hasDiscrepancy(key: keyof WeatherData, threshold: number): boolean {
    const vals = getValues(key);
    if (vals.length < 2) return false;
    return Math.max(...vals) - Math.min(...vals) > threshold;
  }

  return (
    <div className="card">
      {/* Título + metodología */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--tw-secondary)' }}>
            Comparación entre APIs meteorológicas
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--tw-secondary)', opacity: 0.75 }}>
            Las mismas 5 variables se consultan simultáneamente a cada proveedor.
            El valor de consenso es la <strong>media aritmética</strong> de las fuentes disponibles.
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
          style={{ background: 'var(--tw-elevated)', border: '1px solid var(--tw-border)', color: 'var(--tw-secondary)' }}>
          <Info className="w-3.5 h-3.5 text-accent" />
          {available.length} / {sources.length} fuentes activas
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '2px solid var(--tw-border)' }}>
              <th className="text-left py-2 pr-4 text-xs font-semibold" style={{ color: 'var(--tw-secondary)' }}>
                Variable
              </th>
              {sources.map((s) => (
                <th key={s.source} className="text-right py-2 px-3 text-xs font-semibold whitespace-nowrap"
                  style={{ color: s.available ? 'var(--tw-primary)' : 'var(--tw-secondary)' }}>
                  {SOURCE_LABELS[s.source] ?? s.source}
                  {!s.available && (
                    <span className="block text-[10px] font-normal text-red-400">sin datos</span>
                  )}
                </th>
              ))}
              <th className="text-right py-2 px-3 text-xs font-semibold whitespace-nowrap"
                style={{ color: 'var(--tw-accent)' }}>
                Consenso
              </th>
            </tr>
          </thead>
          <tbody>
            {VARIABLES.map(({ key, label, unit, threshold, note }) => {
              const disc = hasDiscrepancy(key, threshold);
              const cons = consensus(key);
              return (
                <tr key={key}
                  className="transition-colors"
                  style={{
                    borderBottom: '1px solid var(--tw-border)',
                    background: disc ? 'rgba(234,179,8,0.06)' : 'transparent',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = disc ? 'rgba(234,179,8,0.10)' : 'var(--tw-table-row)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = disc ? 'rgba(234,179,8,0.06)' : 'transparent')}
                >
                  <td className="py-2.5 pr-4">
                    <span className="flex items-center gap-1.5 text-primary">
                      {disc && <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                      {label}
                    </span>
                    {disc && (
                      <span className="text-[10px]" style={{ color: '#facc15', opacity: 0.8 }}>{note}</span>
                    )}
                  </td>
                  {sources.map((s) => (
                    <td key={s.source}
                      className="py-2.5 px-3 text-right font-mono text-xs"
                      style={{ color: !s.available ? 'var(--tw-secondary)' : disc ? '#facc15' : 'var(--tw-primary)' }}>
                      {s.available ? `${(s[key] as number).toFixed(1)} ${unit}` : '—'}
                    </td>
                  ))}
                  {/* Columna de consenso */}
                  <td className="py-2.5 px-3 text-right font-mono text-xs font-semibold"
                    style={{ color: 'var(--tw-accent)' }}>
                    {cons !== null ? `${cons.toFixed(1)} ${unit}` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 mt-3">
        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--tw-secondary)' }}>
          <AlertTriangle className="w-3 h-3 text-yellow-400" />
          Discrepancia significativa entre proveedores
        </p>
        <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--tw-secondary)' }}>
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'var(--tw-accent)' }} />
          Valor de consenso (promedio de fuentes activas)
        </p>
      </div>
    </div>
  );
}
