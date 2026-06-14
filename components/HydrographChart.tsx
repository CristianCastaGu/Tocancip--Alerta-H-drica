'use client';

import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { HourlyForecast } from '@/lib/types';

interface Props {
  hourly: HourlyForecast[];
}

/* ─── Modelo de tanque simple (WMO EWS) ─────────────────────────────────
   Estima nivel relativo del agua a partir de precipitación acumulada.
   Sin sensores IoT — aproximación hidrológica para cuenca Tocancipá.

   Nivel(t) = Nivel(t-1) + 0.04 * Precip(t) - 0.015
   k_infiltración = 0.015 m/h  (suelo Sabana de Bogotá)
   k_escorrentía  = 0.04  m/mm  (CN ≈ 75, SCS Curve Number)
──────────────────────────────────────────────────────────────────────── */
function simulateLevel(hourly: HourlyForecast[]): { time: string; nivel: number; precip: number; proyeccion: boolean }[] {
  const points: { time: string; nivel: number; precip: number; proyeccion: boolean }[] = [];
  let level = 0.05; // nivel base inicial (m)
  const k_runoff = 0.04;
  const k_drain  = 0.015;
  const now = Date.now();

  for (const h of hourly.slice(0, 48)) {
    level = Math.max(0, level + k_runoff * h.precipitation - k_drain);
    level = Math.min(2.5, level);

    const t = new Date(h.time).getTime();
    const label = new Date(h.time).toLocaleTimeString('es-CO', {
      hour: '2-digit', minute: '2-digit', month: 'numeric', day: 'numeric',
    });

    points.push({
      time: label,
      nivel: parseFloat(level.toFixed(3)),
      precip: parseFloat(h.precipitation.toFixed(1)),
      proyeccion: t > now,
    });
  }
  return points;
}

const UMBRALES = [
  { value: 0.4, label: 'Aviso',      color: '#eab308' },
  { value: 0.8, label: 'Alarma',     color: '#f97316' },
  { value: 1.2, label: 'Emergencia', color: '#ef4444' },
];

const TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 12,
};

export default function HydrographChart({ hourly }: Props) {
  if (!hourly.length) return null;

  const data = simulateLevel(hourly);
  const maxLevel = Math.max(...data.map((d) => d.nivel));
  const yMax = Math.max(1.5, maxLevel + 0.2);

  /* Divide en histórico (sólido) y proyección (punteado) */
  const idxNow = data.findIndex((d) => d.proyeccion);
  const splitTime = idxNow > 0 ? data[idxNow].time : null;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--tw-secondary)' }}>
            Hidrograma estimado — Nivel del agua
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--tw-secondary)', opacity: 0.7 }}>
            Modelo SCS CN-75 · Cuenca Río Bogotá — Tocancipá · Proyección 48h
          </p>
        </div>
        {/* Estado actual */}
        <div className="flex gap-2">
          {UMBRALES.map((u) => (
            <div key={u.label} className="text-center px-2 py-1 rounded-lg"
              style={{ background: `${u.color}15`, border: `1px solid ${u.color}40` }}>
              <p className="text-[10px] font-medium" style={{ color: u.color }}>{u.label}</p>
              <p className="text-xs font-mono font-semibold" style={{ color: u.color }}>{u.value}m</p>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="time"
              tick={{ fill: '#94a3b8', fontSize: 9 }}
              interval={Math.floor(data.length / 8)}
            />
            <YAxis
              yAxisId="nivel"
              domain={[0, yMax]}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              unit="m"
              width={42}
            />
            <YAxis
              yAxisId="precip"
              orientation="right"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              unit="mm"
              width={38}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, name: string) =>
                name === 'Nivel (m)' ? [`${v.toFixed(3)} m`, name] : [`${v} mm/h`, name]
              }
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />

            {/* Umbrales de cota */}
            {UMBRALES.map((u) => (
              <ReferenceLine
                key={u.label}
                yAxisId="nivel"
                y={u.value}
                stroke={u.color}
                strokeDasharray="5 3"
                strokeWidth={1.5}
                label={{ value: u.label, fill: u.color, fontSize: 9, position: 'insideTopRight' }}
              />
            ))}

            {/* Línea de separación histórico/proyección */}
            {splitTime && (
              <ReferenceLine
                yAxisId="nivel"
                x={splitTime}
                stroke="#475569"
                strokeDasharray="3 3"
                label={{ value: 'Ahora', fill: '#475569', fontSize: 9, position: 'top' }}
              />
            )}

            {/* Área de precipitación (eje derecho) */}
            <Area
              yAxisId="precip"
              type="monotone"
              dataKey="precip"
              name="Precipitación (mm/h)"
              fill="#38bdf820"
              stroke="#38bdf860"
              strokeWidth={1}
            />

            {/* Nivel histórico (sólido) */}
            <Line
              yAxisId="nivel"
              type="monotone"
              dataKey={(d) => (!d.proyeccion ? d.nivel : undefined)}
              name="Nivel (m)"
              stroke="#06b6d4"
              strokeWidth={2.5}
              dot={false}
              connectNulls={false}
            />

            {/* Nivel proyectado (punteado) */}
            <Line
              yAxisId="nivel"
              type="monotone"
              dataKey={(d) => (d.proyeccion ? d.nivel : undefined)}
              name="Proyección (m)"
              stroke="#06b6d4"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Nota técnica */}
      <p className="text-[10px] mt-3 leading-relaxed" style={{ color: 'var(--tw-secondary)', opacity: 0.6 }}>
        ⚠️ Estimación preliminar sin sensores IoT. Basada en modelo SCS Curve Number (CN 75)
        para la cuenca del Río Bogotá en Tocancipá. Reemplazar con datos hidrométricos reales
        (IDEAM o sensores de nivel) cuando estén disponibles.
      </p>
    </div>
  );
}
