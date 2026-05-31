'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Thermometer, Droplets, Wind, Cloud, CloudRain, RefreshCw, Bell, Clock } from 'lucide-react';
import WeatherCard from '@/components/WeatherCard';
import RiskSemaphore from '@/components/RiskSemaphore';
import ForecastChart from '@/components/ForecastChart';
import ApiComparison from '@/components/ApiComparison';
import AlertModal from '@/components/AlertModal';
import ApiStatusBadge from '@/components/ApiStatusBadge';
import { WeatherResponse, WeatherData, AlertLevel } from '@/lib/types';
import { evaluateRisk, LEVEL_LABELS, LEVEL_COLORS } from '@/lib/riskEngine';

/* Leaflet requiere el DOM — carga solo en cliente */
const WeatherMap = dynamic(() => import('@/components/WeatherMap'), {
  ssr: false,
  loading: () => (
    <div
      className="card flex items-center justify-center"
      style={{ height: 510 }}
    >
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-sm" style={{ color: 'var(--tw-secondary)' }}>Cargando mapa...</p>
      </div>
    </div>
  ),
});

const DEFAULT_THRESHOLDS = {
  precipPreventivo: 10, precipAlerta: 25, precipEmergencia: 50,
  windPreventivo: 40, windAlerta: 60, windEmergencia: 80, humidityPreventivo: 85,
};

const ALERT_LEVELS: AlertLevel[] = ['INFORMATIVO', 'PREVENTIVO', 'ALERTA', 'EMERGENCIA'];

function avg(sources: WeatherData[], key: keyof WeatherData): number {
  const vals = sources.filter((s) => s.available).map((s) => s[key] as number);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [manualLevel, setManualLevel] = useState<AlertLevel | null>(null);

  const userRole = (session?.user as { role?: string })?.role ?? 'VISOR';
  const canAlert = ['ADMIN', 'OPERADOR'].includes(userRole);

  const fetchWeather = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch('/api/weather');
      if (!res.ok) throw new Error();
      const data: WeatherResponse = await res.json();
      setWeather(data);
      setLastUpdate(new Date());
    } catch { /* mantiene datos previos */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    const id = setInterval(() => fetchWeather(true), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchWeather]);

  const currentLevel: AlertLevel = weather?.current
    ? evaluateRisk(weather.current, DEFAULT_THRESHOLDS)
    : 'INFORMATIVO';

  const representative = weather?.current?.find((s) => s.available) ?? null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Panel de monitoreo</h1>
          <p className="text-sm flex items-center gap-1.5 mt-0.5" style={{ color: 'var(--tw-secondary)' }}>
            <Clock className="w-3.5 h-3.5" />
            {lastUpdate ? `Actualizado: ${lastUpdate.toLocaleTimeString('es-CO')}` : 'Cargando datos...'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => fetchWeather(true)} disabled={refreshing}
            className="btn-ghost flex items-center gap-2 text-sm py-2 px-3">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refrescar
          </button>
          {canAlert && (
            <button onClick={() => { setManualLevel(null); setModalOpen(true); }}
              className="btn-primary flex items-center gap-2 text-sm py-2 px-3">
              <Bell className="w-4 h-4" />
              Activar alerta
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="card h-28 animate-pulse" style={{ background: 'var(--tw-elevated)' }} />
          ))}
        </div>
      ) : weather ? (
        <>
          {/* Cards clima */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--tw-secondary)' }}>
              Condiciones actuales —{' '}
              <span className="text-accent">
                {weather.current.filter((s) => s.available).length} fuentes disponibles
              </span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <WeatherCard label="Temperatura" value={avg(weather.current, 'temperature')} unit="°C" icon={Thermometer} color="#38bdf8" />
              <WeatherCard label="Humedad" value={avg(weather.current, 'humidity')} unit="%" icon={Droplets} color="#22d3ee" />
              <WeatherCard label="Precipitación" value={avg(weather.current, 'precipitation')} unit="mm" icon={CloudRain} color="#60a5fa" />
              <WeatherCard label="Viento" value={avg(weather.current, 'windSpeed')} unit="km/h" icon={Wind} color="#a78bfa" />
              <WeatherCard label="Prob. lluvia" value={avg(weather.current, 'rainProbability')} unit="%" icon={Cloud} color="#67e8f9" />
            </div>
          </section>

          {/* Semáforo + Estado APIs + Alertas manuales */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <RiskSemaphore level={manualLevel ?? currentLevel} triggeredBy={manualLevel ? 'manual' : 'auto'} />

            <div className="lg:col-span-2 flex flex-col gap-4">
              <ApiStatusBadge apiStatus={weather.apiStatus} />

              {canAlert && (
                <div className="card">
                  <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--tw-secondary)' }}>
                    Activación manual
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ALERT_LEVELS.map((level) => (
                      <button key={level}
                        onClick={() => { setManualLevel(level); setModalOpen(true); }}
                        className="py-3 px-2 rounded-lg text-sm font-bold border transition-all
                                   hover:opacity-90 active:scale-95 min-h-[48px]"
                        style={{
                          borderColor: LEVEL_COLORS[level],
                          color: LEVEL_COLORS[level],
                          backgroundColor: `${LEVEL_COLORS[level]}10`,
                        }}>
                        {LEVEL_LABELS[level]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mapa interactivo de radar */}
          <WeatherMap />

          {/* Pronóstico Recharts */}
          <ForecastChart hourly={weather.hourly} daily={weather.daily} />

          {/* Comparación APIs */}
          <ApiComparison sources={weather.current} />
        </>
      ) : (
        <div className="card text-center py-12" style={{ color: 'var(--tw-secondary)' }}>
          Error al cargar los datos del clima. Intenta refrescar.
        </div>
      )}

      <AlertModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => setManualLevel(manualLevel ?? currentLevel)}
        weatherData={representative ?? {}}
      />
    </div>
  );
}
