'use client';

import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { HourlyForecast, DailyForecast } from '@/lib/types';

interface Props {
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#f1f5f9',
  fontSize: 12,
};

function formatHour(time: string) {
  try {
    return new Date(time).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return time.slice(11, 16);
  }
}

function formatDay(date: string) {
  try {
    return new Date(date + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
  } catch {
    return date;
  }
}

export default function ForecastChart({ hourly, daily }: Props) {
  const [tab, setTab] = useState<'hourly' | 'daily'>('hourly');

  const hourlyData = hourly.slice(0, 24).map((h) => ({
    time: formatHour(h.time),
    'Temperatura (°C)': Number(h.temperature.toFixed(1)),
    'Precipitación (mm)': Number(h.precipitation.toFixed(1)),
    'Prob. lluvia (%)': Number(h.rainProbability.toFixed(0)),
  }));

  const dailyData = daily.map((d) => ({
    date: formatDay(d.date),
    'Precipitación (mm)': Number(d.precipSum.toFixed(1)),
    'Temp. Máx (°C)': Number(d.tempMax.toFixed(1)),
    'Temp. Mín (°C)': Number(d.tempMin.toFixed(1)),
  }));

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Pronóstico</h2>
        <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
          {(['hourly', 'daily'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === t ? 'bg-accent text-slate-900' : 'text-slate-400 hover:text-primary'
              }`}
            >
              {t === 'hourly' ? 'Horario (24h)' : 'Diario (7d)'}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          {tab === 'hourly' ? (
            <LineChart data={hourlyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={3} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Line type="monotone" dataKey="Temperatura (°C)" stroke="#38bdf8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Precipitación (mm)" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Prob. lluvia (%)" stroke="#eab308" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          ) : (
            <BarChart data={dailyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Bar dataKey="Precipitación (mm)" fill="#38bdf8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Temp. Máx (°C)" fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Temp. Mín (°C)" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
