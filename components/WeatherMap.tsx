'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map, TileLayer, Marker, GeoJSON as LeafletGeoJSON } from 'leaflet';

/* Coordenadas IGAC — casco urbano Tocancipá (Cundinamarca) */
const TOCANCIPA: [number, number] = [4.9653, -73.9144];
const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY ?? '';

/* ─── Capas meteorológicas ─── */
const WEATHER_LAYERS = [
  { id: 'precipitation_new', label: 'Precipitación', color: '#60a5fa', opacity: 0.75 },
  { id: 'clouds_new',        label: 'Nubosidad',     color: '#94a3b8', opacity: 0.55 },
  { id: 'wind_new',          label: 'Viento',         color: '#a78bfa', opacity: 0.70 },
  { id: 'temp_new',          label: 'Temperatura',   color: '#f97316', opacity: 0.65 },
] as const;

type LayerId = (typeof WEATHER_LAYERS)[number]['id'];

const LEGENDS: Record<LayerId, [string, string][]> = {
  precipitation_new: [['0–1 mm/h','#a0d4fb'],['1–3 mm/h','#4da6ff'],['3–10 mm/h','#0055cc'],['10–30 mm/h','#ffff00'],['>30 mm/h','#ff0000']],
  clouds_new:        [['Despejado','#ffffff30'],['Parcial','#94a3b880'],['Cubierto','#94a3b8']],
  wind_new:          [['Calma','#a78bfa20'],['Brisa','#a78bfa80'],['Fuerte','#a78bfa']],
  temp_new:          [['< 10°C','#4da6ff'],['10–20°C','#22c55e'],['20–30°C','#eab308'],['>30°C','#ef4444']],
};

/* ─── Capas GIS (IDEAM/SGC — aproximación hasta datos oficiales) ─── */
const GIS_LAYERS = [
  { id: 'flood',     label: 'Zona inundación',  color: '#3b82f6' },
  { id: 'esmeralda', label: 'Vereda Esmeralda', color: '#f97316' },
  { id: 'evacuation',label: 'Ruta evacuación',  color: '#22c55e' },
] as const;

type GisId = (typeof GIS_LAYERS)[number]['id'];

/* GeoJSON aproximado — fuente: cruce cartografía IGAC 1:25000 + Río Bogotá */
const GEO: Record<GisId, object> = {
  /* Planicie de inundación Río Bogotá al oeste de Tocancipá */
  flood: {
    type: 'Feature',
    properties: { name: 'Zona de inundación histórica — Río Bogotá' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-73.980, 4.940], [-73.975, 4.945], [-73.972, 4.960],
        [-73.970, 4.975], [-73.972, 4.990], [-73.978, 4.995],
        [-73.985, 4.990], [-73.988, 4.975], [-73.985, 4.955],
        [-73.982, 4.943], [-73.980, 4.940],
      ]],
    },
  },
  /* Vereda La Esmeralda — zona de riesgo potencial */
  esmeralda: {
    type: 'Feature',
    properties: { name: 'Vereda La Esmeralda — Zona de riesgo' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-73.930, 4.955], [-73.922, 4.958], [-73.918, 4.965],
        [-73.920, 4.972], [-73.928, 4.975], [-73.936, 4.971],
        [-73.938, 4.963], [-73.934, 4.956], [-73.930, 4.955],
      ]],
    },
  },
  /* Ruta de evacuación principal — Autopista Norte hacia Bogotá */
  evacuation: {
    type: 'Feature',
    properties: { name: 'Ruta de evacuación — Autopista Norte' },
    geometry: {
      type: 'LineString',
      coordinates: [
        [-73.914, 4.980], [-73.915, 4.970], [-73.916, 4.960],
        [-73.917, 4.950], [-73.918, 4.940], [-73.920, 4.925],
      ],
    },
  },
};

export default function WeatherMap() {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<Map | null>(null);
  const owmLayerRef   = useRef<TileLayer | null>(null);
  const markerRef     = useRef<Marker | null>(null);
  const gisRefs       = useRef<Partial<Record<GisId, LeafletGeoJSON>>>({});

  const [activeLayer, setActiveLayer]   = useState<LayerId>('precipitation_new');
  const [activeGis,   setActiveGis]     = useState<Set<GisId>>(new Set());
  const activeLayerRef = useRef<LayerId>('precipitation_new');

  /* ── Inicializa el mapa ── */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import('leaflet').then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, { center: TOCANCIPA, zoom: 12 });
      mapRef.current = map;

      /* Base oscura */
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      /* Capa OWM inicial */
      if (OWM_KEY) {
        const lyr = WEATHER_LAYERS.find((l) => l.id === activeLayerRef.current)!;
        owmLayerRef.current = L.tileLayer(
          `https://tile.openweathermap.org/map/${lyr.id}/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
          { opacity: lyr.opacity, attribution: '&copy; OpenWeatherMap' }
        ).addTo(map);
      }

      /* Marcador municipio */
      markerRef.current = L.marker(TOCANCIPA)
        .addTo(map)
        .bindPopup(`
          <div style="font-family:Inter,sans-serif">
            <strong style="font-size:13px">Tocancipá</strong>
            <hr style="margin:4px 0;border-color:#334155"/>
            <div style="font-size:11px;color:#94a3b8">
              Lat 4.9653° N &nbsp;|&nbsp; Lon 73.9144° O<br/>
              Altitud: 2 585 m s.n.m.<br/>
              Municipio de Cundinamarca
            </div>
          </div>
        `);

      /* Marcador Vereda La Esmeralda */
      L.circleMarker([4.963, -73.928], { radius: 8, color: '#f97316', fillColor: '#f9731640', fillOpacity: 0.8, weight: 2 })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:Inter,sans-serif">
            <strong style="font-size:12px;color:#f97316">Vereda La Esmeralda</strong>
            <hr style="margin:4px 0;border-color:#334155"/>
            <div style="font-size:11px;color:#94a3b8">
              Zona de riesgo potencial<br/>Inundación — Río Bogotá
            </div>
          </div>
        `);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      owmLayerRef.current = null;
      markerRef.current = null;
      gisRefs.current = {};
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Cambia capa meteorológica ── */
  useEffect(() => {
    activeLayerRef.current = activeLayer;
    if (!mapRef.current) return;

    import('leaflet').then((L) => {
      if (owmLayerRef.current) {
        mapRef.current!.removeLayer(owmLayerRef.current);
        owmLayerRef.current = null;
      }
      if (!OWM_KEY) return;
      const lyr = WEATHER_LAYERS.find((l) => l.id === activeLayer)!;
      owmLayerRef.current = L.tileLayer(
        `https://tile.openweathermap.org/map/${activeLayer}/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
        { opacity: lyr.opacity, attribution: '&copy; OpenWeatherMap' }
      ).addTo(mapRef.current!);
    });
  }, [activeLayer]);

  /* ── Activa/desactiva capas GIS ── */
  function toggleGis(id: GisId) {
    if (!mapRef.current) return;

    import('leaflet').then((L) => {
      const map = mapRef.current!;
      const gisLayer = GIS_LAYERS.find((g) => g.id === id)!;

      if (gisRefs.current[id]) {
        map.removeLayer(gisRefs.current[id]!);
        delete gisRefs.current[id];
        setActiveGis((prev) => { const s = new Set(prev); s.delete(id); return s; });
      } else {
        const isLine = (GEO[id] as { geometry: { type: string } }).geometry.type === 'LineString';
        const layer = L.geoJSON(GEO[id] as Parameters<typeof L.geoJSON>[0], {
          style: () => ({
            color: gisLayer.color,
            weight: isLine ? 3 : 1.5,
            opacity: 0.9,
            fillColor: gisLayer.color,
            fillOpacity: isLine ? 0 : 0.18,
            dashArray: isLine ? '8 4' : undefined,
          }),
          onEachFeature: (feature, lyr) => {
            if (feature.properties?.name) {
              lyr.bindPopup(`<div style="font-family:Inter,sans-serif;font-size:12px">${feature.properties.name}<br/><span style="font-size:10px;color:#94a3b8">Datos aproximados — IGAC 1:25000</span></div>`);
            }
          },
        }).addTo(map);
        gisRefs.current[id] = layer;
        setActiveGis((prev) => new Set(prev).add(id));
      }
    });
  }

  const currentLyr = WEATHER_LAYERS.find((l) => l.id === activeLayer)!;

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--tw-border)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--tw-secondary)' }}>
              Radar meteorológico + Capas GIS — Tocancipá
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--tw-secondary)', opacity: 0.7 }}>
              OpenWeatherMap · Tiempo real &nbsp;|&nbsp; Cartografía: IGAC / SGC
            </p>
          </div>
        </div>

        {/* Capas meteo */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {WEATHER_LAYERS.map((lyr) => {
            const active = activeLayer === lyr.id;
            return (
              <button key={lyr.id} onClick={() => setActiveLayer(lyr.id)}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                style={{
                  color: lyr.color,
                  background: active ? `${lyr.color}20` : 'transparent',
                  border: `1px solid ${active ? lyr.color : 'var(--tw-border)'}`,
                }}>
                {lyr.label}
              </button>
            );
          })}
        </div>

        {/* Capas GIS */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide font-medium mr-1" style={{ color: 'var(--tw-secondary)' }}>
            GIS:
          </span>
          {GIS_LAYERS.map((g) => {
            const on = activeGis.has(g.id);
            return (
              <button key={g.id} onClick={() => toggleGis(g.id)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  color: g.color,
                  background: on ? `${g.color}20` : 'transparent',
                  border: `1px solid ${on ? g.color : 'var(--tw-border)'}`,
                  opacity: on ? 1 : 0.6,
                }}>
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mapa */}
      <div style={{ height: 460, position: 'relative' }}>
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

        {/* Leyenda meteo */}
        <div className="absolute bottom-8 left-3 z-[1000] px-3 py-2 rounded-lg text-xs"
          style={{ background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(6px)', border: '1px solid var(--tw-border)' }}>
          <p className="font-semibold text-primary mb-1.5">{currentLyr.label}</p>
          <div className="space-y-1">
            {LEGENDS[activeLayer].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5" style={{ color: 'var(--tw-secondary)' }}>
                <div className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ background: color, border: '1px solid rgba(255,255,255,0.15)' }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leyenda GIS */}
        {activeGis.size > 0 && (
          <div className="absolute bottom-8 right-3 z-[1000] px-3 py-2 rounded-lg text-xs"
            style={{ background: 'rgba(15,23,42,0.88)', backdropFilter: 'blur(6px)', border: '1px solid var(--tw-border)' }}>
            <p className="font-semibold text-primary mb-1.5">Capas activas</p>
            <div className="space-y-1">
              {GIS_LAYERS.filter((g) => activeGis.has(g.id)).map((g) => (
                <div key={g.id} className="flex items-center gap-1.5" style={{ color: 'var(--tw-secondary)' }}>
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: g.color, opacity: 0.7 }} />
                  <span>{g.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
