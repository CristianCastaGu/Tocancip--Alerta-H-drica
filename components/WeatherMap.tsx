'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map, TileLayer, Marker } from 'leaflet';

/* Coordenadas IGAC — casco urbano Tocancipá (Cundinamarca) */
const TOCANCIPA: [number, number] = [4.9653, -73.9144];
const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY ?? '';

const LAYERS = [
  { id: 'precipitation_new', label: 'Precipitación', color: '#60a5fa', opacity: 0.75 },
  { id: 'clouds_new',        label: 'Nubosidad',     color: '#94a3b8', opacity: 0.55 },
  { id: 'wind_new',          label: 'Viento',         color: '#a78bfa', opacity: 0.70 },
  { id: 'temp_new',          label: 'Temperatura',   color: '#f97316', opacity: 0.65 },
] as const;

type LayerId = (typeof LAYERS)[number]['id'];

const LEGENDS: Record<LayerId, [string, string][]> = {
  precipitation_new: [['0–1 mm/h','#a0d4fb'],['1–3 mm/h','#4da6ff'],['3–10 mm/h','#0055cc'],['10–30 mm/h','#ffff00'],['>30 mm/h','#ff0000']],
  clouds_new:        [['Despejado','#ffffff30'],['Parcial','#94a3b880'],['Cubierto','#94a3b8']],
  wind_new:          [['Calma','#a78bfa20'],['Brisa','#a78bfa80'],['Fuerte','#a78bfa']],
  temp_new:          [['< 10°C','#4da6ff'],['10–20°C','#22c55e'],['20–30°C','#eab308'],['>30°C','#ef4444']],
};

export default function WeatherMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<Map | null>(null);
  const owmLayerRef  = useRef<TileLayer | null>(null);
  const markerRef    = useRef<Marker | null>(null);
  const [activeLayer, setActiveLayer] = useState<LayerId>('precipitation_new');
  const activeLayerRef = useRef<LayerId>('precipitation_new');

  /* ── Inicializa el mapa una sola vez ── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    /* Importa Leaflet solo en el cliente */
    import('leaflet').then((L) => {
      /* Corrige los íconos rotos de webpack */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, { center: TOCANCIPA, zoom: 9 });
      mapRef.current = map;

      /* Capa base oscura */
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      /* Capa meteorológica inicial */
      if (OWM_KEY) {
        const lyr = LAYERS.find((l) => l.id === activeLayerRef.current)!;
        owmLayerRef.current = L.tileLayer(
          `https://tile.openweathermap.org/map/${lyr.id}/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
          { opacity: lyr.opacity, attribution: '&copy; OpenWeatherMap' }
        ).addTo(map);
      }

      /* Marcador */
      markerRef.current = L.marker(TOCANCIPA)
        .addTo(map)
        .bindPopup(`
          <div style="font-family:Inter,sans-serif">
            <strong style="font-size:13px">Tocancipá</strong>
            <hr style="margin:4px 0;border-color:#e2e8f0"/>
            <div style="font-size:11px;color:#475569">
              Lat 4.9653° N &nbsp;|&nbsp; Lon 73.9144° O<br/>Altitud: 2 585 m s.n.m.
            </div>
          </div>
        `);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current   = null;
      owmLayerRef.current = null;
      markerRef.current   = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cambia la capa meteorológica cuando el usuario elige otra ── */
  useEffect(() => {
    activeLayerRef.current = activeLayer;
    if (!mapRef.current) return;

    import('leaflet').then((L) => {
      if (owmLayerRef.current) {
        mapRef.current!.removeLayer(owmLayerRef.current);
        owmLayerRef.current = null;
      }
      if (!OWM_KEY) return;

      const lyr = LAYERS.find((l) => l.id === activeLayer)!;
      owmLayerRef.current = L.tileLayer(
        `https://tile.openweathermap.org/map/${activeLayer}/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
        { opacity: lyr.opacity, attribution: '&copy; OpenWeatherMap' }
      ).addTo(mapRef.current!);
    });
  }, [activeLayer]);

  const currentLyr = LAYERS.find((l) => l.id === activeLayer)!;

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--tw-border)' }}>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider"
            style={{ color: 'var(--tw-secondary)' }}>
            Radar meteorológico — Tocancipá
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--tw-secondary)', opacity: 0.7 }}>
            OpenWeatherMap · Tiempo real
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LAYERS.map((lyr) => {
            const active = activeLayer === lyr.id;
            return (
              <button key={lyr.id} onClick={() => setActiveLayer(lyr.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  color: lyr.color,
                  background: active ? `${lyr.color}20` : 'transparent',
                  border: `1px solid ${active ? lyr.color : 'var(--tw-border)'}`,
                  transform: active ? 'scale(1.04)' : 'scale(1)',
                }}>
                {lyr.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenedor del mapa */}
      <div style={{ height: 440, position: 'relative' }}>
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

        {/* Leyenda */}
        <div className="absolute bottom-8 left-3 z-[1000] px-3 py-2 rounded-lg text-xs"
          style={{
            background: 'rgba(15,23,42,0.85)',
            backdropFilter: 'blur(6px)',
            border: '1px solid var(--tw-border)',
          }}>
          <p className="font-semibold text-primary mb-1.5">{currentLyr.label}</p>
          <div className="space-y-1">
            {LEGENDS[activeLayer].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5"
                style={{ color: 'var(--tw-secondary)' }}>
                <div className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ background: color, border: '1px solid rgba(255,255,255,0.15)' }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
