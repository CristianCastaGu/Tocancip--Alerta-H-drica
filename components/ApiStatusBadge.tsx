'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { WeatherSource } from '@/lib/types';

interface ApiStatus {
  ok: boolean;
  lastSuccess: string | null;
}

interface Props {
  apiStatus: Record<WeatherSource, ApiStatus>;
}

const SOURCE_LABELS: Record<WeatherSource, string> = {
  'open-meteo': 'Open-Meteo',
  openweather:  'OpenWeather',
  weatherapi:   'WeatherAPI',
  meteoblue:    'Meteoblue',
};

function formatTime(iso: string | null): string {
  if (!iso) return 'Sin datos';
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function ApiStatusBadge({ apiStatus }: Props) {
  const sources = Object.keys(apiStatus) as WeatherSource[];

  return (
    <div className="card">
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--tw-secondary)' }}>
        Estado de APIs
      </h2>
      <div className="space-y-2">
        {sources.map((source) => {
          const { ok, lastSuccess } = apiStatus[source];
          return (
            <div key={source} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2">
                {ok
                  ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                <span className="text-sm font-medium text-primary">{SOURCE_LABELS[source]}</span>
              </div>
              <span className="text-xs font-mono" style={{ color: 'var(--tw-secondary)' }}>
                {formatTime(lastSuccess)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
