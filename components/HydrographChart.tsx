'use client';

import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { HourlyForecast } from '@/lib/types';

interface Props {
  hourly: HourlyForecast[];      // desde la hora actual (pronóstico)
  pastHourly?: HourlyForecast[]; // horas previas (lluvia ya caída)
}

/* ─── Modelo lluvia–escorrentía ──────────────────────────────────────────
   1. Escorrentía directa por el método SCS Curve Number (USDA NRCS, TR-55):
        S  = 25400 / CN − 254        retención potencial máxima (mm)
        Ia = 0,2 · S                 abstracción inicial (mm)
        Q  = (P − Ia)² / (P + 0,8·S) escorrentía acumulada, si P > Ia
      P es la lluvia acumulada del evento; el evento se reinicia tras
      12 h continuas sin lluvia.
   2. Tránsito por embalse lineal: Alm(t) = Alm(t−1)·(1 − k) + ΔQ(t)
   3. Nivel relativo = nivel base + c · Alm

   CN, k y c son valores de partida SIN calibrar: no hay curva de gasto ni
   sensor de nivel en el punto. El resultado es una tendencia, no una cota.
──────────────────────────────────────────────────────────────────────── */
const MODEL = {
  cn: 75,              // suelo agrícola/pastos, condición de humedad media
  recession: 0.08,     // k — fracción del almacenamiento que drena por hora
  mPerMm: 0.06,        // c — metros de nivel por mm almacenado
  baseLevel: 0.05,     // m
  dryHoursReset: 12,
  dryThreshold: 0.1,   // mm/h por debajo del cual la hora cuenta como seca
};

const PAST_HOURS_SHOWN = 24;

interface Point {
  time: string;
  nivel: number | null;       // tramo ya transcurrido
  proyeccion: number | null;  // tramo pronosticado
  precip: number;
}

function scsRunoff(p: number, s: number): number {
  const ia = 0.2 * s;
  return p > ia ? (p - ia) ** 2 / (p + 0.8 * s) : 0;
}

function formatLabel(time: string): string {
  return new Date(time).toLocaleString('es-CO', {
    timeZone: 'America/Bogota', day: 'numeric', month: 'numeric', hour: '2-digit', hour12: false,
  }) + ' h';
}

function simulate(past: HourlyForecast[], future: HourlyForecast[]): { points: Point[]; nowLabel: string | null; peak: number } {
  const s = 25400 / MODEL.cn - 254;
  const series = [...past, ...future.slice(0, 48)];
  const firstShown = Math.max(0, past.length - PAST_HOURS_SHOWN);

  let eventRain = 0;
  let dryHours = 0;
  let prevRunoff = 0;
  let storage = 0;
  let peak = 0;
  const points: Point[] = [];

  series.forEach((h, i) => {
    if (h.precipitation < MODEL.dryThreshold) {
      dryHours += 1;
      if (dryHours >= MODEL.dryHoursReset) { eventRain = 0; prevRunoff = 0; }
    } else {
      dryHours = 0;
    }
    eventRain += h.precipitation;

    const runoff = scsRunoff(eventRain, s);
    storage = storage * (1 - MODEL.recession) + Math.max(0, runoff - prevRunoff);
    prevRunoff = runoff;

    if (i < firstShown) return; // las horas anteriores solo "calientan" el modelo

    const level = Number(Math.min(3, MODEL.baseLevel + MODEL.mPerMm * storage).toFixed(3));
    const isPast = i < past.length;
    /* El último punto transcurrido también inicia la proyección, para que las líneas empalmen */
    const joins = i === past.length - 1;
    if (!isPast) peak = Math.max(peak, level);

    points.push({
      time: formatLabel(h.time),
      nivel: isPast ? level : null,
      proyeccion: !isPast || joins ? level : null,
      precip: Number(h.precipitation.toFixed(1)),
    });
  });

  const nowLabel = future.length ? formatLabel(future[0].time) : null;
  return { points, nowLabel, peak };
}

const UMBRALES = [
  { value: 0.4, label: 'Aviso',      color: '#eab308' },
  { value: 0.8, label: 'Alarma',     color: '#f97316' },
  { value: 1.2, label: 'Emergencia', color: '#ef4444' },
];

const AXIS_TICK = { fill: 'var(--tw-secondary)', fontSize: 10 };

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--tw-card)',
  border: '1px solid var(--tw-border)',
  borderRadius: 8,
  color: 'var(--tw-primary)',
  fontSize: 12,
};

export default function HydrographChart({ hourly, pastHourly = [] }: Props) {
  if (!hourly.length) return null;

  const { points, nowLabel, peak } = simulate(pastHourly, hourly);
  const maxLevel = Math.max(...points.map((d) => d.nivel ?? d.proyeccion ?? 0));
  const yMax = Math.max(1.5, Math.ceil((maxLevel + 0.2) * 10) / 10);
  const peakStage = [...UMBRALES].reverse().find((u) => peak >= u.value);

  return (
    <div className="card">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--tw-secondary)' }}>
            Hidrograma estimado — Nivel relativo
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--tw-secondary)', opacity: 0.7 }}>
            Método SCS-CN (CN {MODEL.cn}) + embalse lineal · {Math.min(pastHourly.length, PAST_HOURS_SHOWN)} h
            observadas + {Math.min(hourly.length, 48)} h de pronóstico
          </p>
          <p className="text-xs mt-1 font-medium" style={{ color: peakStage?.color ?? '#22c55e' }}>
            Pico proyectado: {peak.toFixed(2)} m{peakStage ? ` — supera ${peakStage.label}` : ' — bajo el nivel de aviso'}
          </p>
        </div>
        {/* Umbrales */}
        <div className="flex gap-2">
          {UMBRALES.map((u) => (
            <div key={u.label} className="text-center px-2 py-1 rounded-lg"
              style={{ background: `${u.color}15`, border: `1px solid ${u.color}40` }}>
              <p className="text-[10px] font-medium" style={{ color: u.color }}>{u.label}</p>
              <p className="text-xs font-mono font-semibold" style={{ color: u.color }}>{u.value} m</p>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 12, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-border)" />
            <XAxis
              dataKey="time"
              tick={{ ...AXIS_TICK, fontSize: 9 }}
              interval={Math.max(0, Math.floor(points.length / 9))}
            />
            <YAxis yAxisId="nivel" domain={[0, yMax]} tick={AXIS_TICK} unit=" m" width={46} />
            <YAxis yAxisId="precip" orientation="right" tick={AXIS_TICK} unit=" mm" width={44} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number, name: string) =>
                name.startsWith('Lluvia') ? [`${v} mm/h`, name] : [`${v.toFixed(2)} m`, name]
              }
            />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--tw-secondary)' }} />

            {/* Lluvia horaria (eje derecho) */}
            <Bar yAxisId="precip" dataKey="precip" name="Lluvia (mm/h)" fill="#38bdf8" fillOpacity={0.35} isAnimationActive={false} />

            {/* Umbrales de nivel */}
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

            {/* Separación observado / pronóstico */}
            {nowLabel && (
              <ReferenceLine
                yAxisId="nivel"
                x={nowLabel}
                stroke="var(--tw-secondary)"
                strokeDasharray="3 3"
                label={{ value: 'Ahora', fill: 'var(--tw-secondary)', fontSize: 9, position: 'top' }}
              />
            )}

            <Line yAxisId="nivel" type="monotone" dataKey="nivel" name="Nivel con lluvia registrada (m)"
              stroke="#06b6d4" strokeWidth={2.5} dot={false} connectNulls={false} isAnimationActive={false} />
            <Line yAxisId="nivel" type="monotone" dataKey="proyeccion" name="Proyección (m)"
              stroke="#06b6d4" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Nota técnica */}
      <p className="text-[10px] mt-3 leading-relaxed" style={{ color: 'var(--tw-secondary)', opacity: 0.75 }}>
        ⚠️ Estimación de tendencia, no una medición. No hay sensor de nivel ni curva de gasto en el punto:
        los parámetros (CN {MODEL.cn}, recesión {MODEL.recession}/h, {MODEL.mPerMm} m por mm) y los niveles de
        Aviso/Alarma/Emergencia son valores de partida sin calibrar. No usar como único criterio para evacuar;
        confirmar siempre con observación en campo y boletines del IDEAM.
      </p>
    </div>
  );
}
