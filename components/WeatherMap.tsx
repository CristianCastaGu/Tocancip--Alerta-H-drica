'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map, TileLayer, LayerGroup, LatLngBoundsExpression } from 'leaflet';
import type { Feature, FeatureCollection } from 'geojson';
import { Crosshair } from 'lucide-react';
import { TOCANCIPA_LAT, TOCANCIPA_LON, TOCANCIPA_ASL } from '@/lib/location';

const TOCANCIPA: [number, number] = [TOCANCIPA_LAT, TOCANCIPA_LON];
const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY ?? '';

/* Encuadre inicial: casco urbano, La Esmeralda y el tramo cercano del Río Bogotá */
const HOME_BOUNDS: LatLngBoundsExpression = [[4.950, -73.930], [4.990, -73.880]];

/* ─── Mapas base (ambos sin API key) ─── */
const BASE_LAYERS = [
  {
    id: 'streets', label: 'Calles',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  {
    id: 'satellite', label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imágenes &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 18,
  },
] as const;

type BaseId = (typeof BASE_LAYERS)[number]['id'];

/* ─── Capas meteorológicas (OpenWeatherMap) ─── */
const WEATHER_LAYERS = [
  { id: 'precipitation_new', label: 'Precipitación', color: '#3b82f6', opacity: 0.75 },
  { id: 'clouds_new',        label: 'Nubosidad',     color: '#64748b', opacity: 0.55 },
  { id: 'wind_new',          label: 'Viento',        color: '#8b5cf6', opacity: 0.70 },
  { id: 'temp_new',          label: 'Temperatura',   color: '#f97316', opacity: 0.65 },
] as const;

type LayerId = (typeof WEATHER_LAYERS)[number]['id'];

const LEGENDS: Record<LayerId, [string, string][]> = {
  precipitation_new: [['0–1 mm/h','#a0d4fb'],['1–3 mm/h','#4da6ff'],['3–10 mm/h','#0055cc'],['10–30 mm/h','#ffff00'],['>30 mm/h','#ff0000']],
  clouds_new:        [['Despejado','#ffffff30'],['Parcial','#94a3b880'],['Cubierto','#94a3b8']],
  wind_new:          [['Calma','#a78bfa20'],['Brisa','#a78bfa80'],['Fuerte','#a78bfa']],
  temp_new:          [['< 10°C','#4da6ff'],['10–20°C','#22c55e'],['20–30°C','#eab308'],['>30°C','#ef4444']],
};

/* ─── Capas GIS ──────────────────────────────────────────────────────────
   La geometría vive en public/gis/*.geojson. Para usar cartografía oficial
   (IGAC, CAR, PMGRD) basta reemplazar esos archivos conservando la propiedad
   "kind" de cada elemento; no hay que tocar este componente. */
const GIS_LAYERS = [
  { id: 'flood',      label: 'Zona inundación',  color: '#2563eb', file: '/gis/zona-inundacion.geojson',  legend: 'Franjas inundables de referencia: Río Bogotá y Quebrada La Esmeralda (punteado: tramo estimado)' },
  { id: 'esmeralda',  label: 'Vereda Esmeralda', color: '#ea580c', file: '/gis/vereda-esmeralda.geojson', legend: 'La Esmeralda — población a alertar' },
  { id: 'evacuation', label: 'Ruta evacuación',  color: '#16a34a', file: '/gis/ruta-evacuacion.geojson',  legend: 'Ruta de evacuación de referencia' },
] as const;

type GisId = (typeof GIS_LAYERS)[number]['id'];
const ALL_GIS: GisId[] = GIS_LAYERS.map((g) => g.id);

function escapeHtml(text: unknown): string {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function popupHtml(feature: Feature, color: string): string {
  const p = feature.properties ?? {};
  return `
    <div style="font-family:Inter,sans-serif;max-width:240px">
      <strong style="font-size:12px;color:${color}">${escapeHtml(p.name)}</strong>
      <div style="font-size:11px;margin-top:4px">${escapeHtml(p.description)}</div>
      <div style="font-size:10px;margin-top:6px;opacity:0.75">Fuente: ${escapeHtml(p.source)}</div>
      ${p.official ? '' : '<div style="font-size:10px;margin-top:4px;font-weight:600;color:#b45309">Referencial — no es cartografía oficial</div>'}
    </div>`;
}

export default function WeatherMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<Map | null>(null);
  const baseRef      = useRef<TileLayer | null>(null);
  const owmLayerRef  = useRef<TileLayer | null>(null);
  const gisRefs      = useRef<Partial<Record<GisId, LayerGroup>>>({});

  const [ready, setReady]             = useState(false);
  const [base, setBase]               = useState<BaseId>('streets');
  const [activeLayer, setActiveLayer] = useState<LayerId | null>('precipitation_new');
  const [activeGis, setActiveGis]     = useState<Set<GisId>>(new Set(ALL_GIS));
  const [gisError, setGisError]       = useState(false);

  /* ── Inicializa el mapa y carga las capas GIS ── */
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    import('leaflet').then(async (L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { scrollWheelZoom: false });
      map.fitBounds(HOME_BOUNDS);
      mapRef.current = map;
      L.control.scale({ imperial: false }).addTo(map);

      /* Si el contenedor cambia de tamaño después de crear el mapa, Leaflet deja
         zonas sin teselas hasta que se le avisa. */
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(containerRef.current);

      const pin = (color: string, text: string) => L.divIcon({
        className: '',
        html: `<div class="tah-pin" style="background:${color}">${text}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      /* Marcador del casco urbano (punto de consulta de las APIs) */
      L.marker(TOCANCIPA, { icon: pin('#0f172a', 'T') })
        .addTo(map)
        .bindTooltip('Tocancipá', { permanent: true, direction: 'top', offset: [0, -12], className: 'tah-map-label' })
        .bindPopup(`
          <div style="font-family:Inter,sans-serif">
            <strong style="font-size:13px">Tocancipá — casco urbano</strong>
            <div style="font-size:11px;margin-top:4px">
              Lat ${TOCANCIPA_LAT}° N · Lon ${Math.abs(TOCANCIPA_LON)}° O<br/>
              Altitud: ${TOCANCIPA_ASL.toLocaleString('es-CO')} m s.n.m.<br/>
              Punto de consulta de las 4 fuentes meteorológicas
            </div>
          </div>
        `);

      setReady(true);

      /* Capas GIS */
      const results = await Promise.all(
        GIS_LAYERS.map(async (g) => {
          try {
            const res = await fetch(g.file);
            if (!res.ok) throw new Error();
            return (await res.json()) as FeatureCollection;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      if (results.some((r) => r === null)) setGisError(true);

      GIS_LAYERS.forEach((g, i) => {
        const data = results[i];
        if (!data) return;
        const group = L.layerGroup();

        /* Borde blanco bajo las líneas para que se lean sobre cualquier mapa base */
        const lines = data.features.filter((f) => f.geometry.type === 'LineString' && f.properties?.kind !== 'stream-est');
        if (lines.length) {
          L.geoJSON(lines, { style: { color: '#ffffff', weight: 9, opacity: 0.9 }, interactive: false }).addTo(group);
        }

        L.geoJSON(data, {
          style: (feature) => {
            const kind = feature?.properties?.kind;
            if (kind === 'river') return { color: '#1d4ed8', weight: 4, opacity: 1 };
            if (kind === 'stream') return { color: '#0891b2', weight: 5, opacity: 1 };
            /* Tramo sin levantar: punteado para que no se lea como cauce confirmado */
            if (kind === 'stream-est') return { color: '#0891b2', weight: 3, opacity: 1, dashArray: '4 8' };
            if (kind === 'route') return { color: g.color, weight: 5, opacity: 1 };
            return {
              color: g.color, weight: 2.5, opacity: 1,
              fillColor: g.color, fillOpacity: 0.28,
              dashArray: g.id === 'esmeralda' ? '6 5' : undefined,
            };
          },
          pointToLayer: (feature, latlng) => {
            const kind = feature.properties?.kind;
            const text = kind === 'start' ? 'A' : kind === 'end' ? 'B' : '!';
            return L.marker(latlng, { icon: pin(g.color, text) });
          },
          onEachFeature: (feature, lyr) => {
            lyr.bindPopup(popupHtml(feature, g.color));
            const kind = feature.properties?.kind;
            const label =
              kind === 'river' ? 'Río Bogotá'
              : kind === 'stream' ? 'Quebrada La Esmeralda'
              : kind === 'place' ? 'La Esmeralda'
              : kind === 'start' ? 'Salida'
              : kind === 'end' ? 'Punto de encuentro'
              : null;
            if (label) {
              lyr.bindTooltip(label, {
                permanent: true,
                direction: kind === 'river' ? 'center' : kind === 'stream' ? 'bottom' : kind === 'place' ? 'left' : kind === 'end' ? 'bottom' : 'right',
                offset: kind === 'river' ? [0, 0] : kind === 'stream' ? [0, 10] : kind === 'place' ? [-14, 0] : kind === 'end' ? [0, 14] : [14, 0],
                className: 'tah-map-label',
              });
            }
          },
        }).addTo(group);

        gisRefs.current[g.id] = group;
        group.addTo(map); // todas visibles al cargar
      });
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      baseRef.current = null;
      owmLayerRef.current = null;
      gisRefs.current = {};
    };
  }, []);

  /* ── Mapa base ── */
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;
    import('leaflet').then((L) => {
      const map = mapRef.current;
      if (cancelled || !map) return;
      if (baseRef.current) map.removeLayer(baseRef.current);
      const cfg = BASE_LAYERS.find((b) => b.id === base)!;
      baseRef.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom, zIndex: 1 }).addTo(map);
    });
    return () => { cancelled = true; };
  }, [ready, base]);

  /* ── Capa meteorológica ── */
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let cancelled = false;
    import('leaflet').then((L) => {
      const map = mapRef.current;
      if (cancelled || !map) return;
      if (owmLayerRef.current) {
        map.removeLayer(owmLayerRef.current);
        owmLayerRef.current = null;
      }
      if (!OWM_KEY || !activeLayer) return;
      const lyr = WEATHER_LAYERS.find((l) => l.id === activeLayer)!;
      owmLayerRef.current = L.tileLayer(
        `https://tile.openweathermap.org/map/${activeLayer}/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
        { opacity: lyr.opacity, attribution: '&copy; OpenWeatherMap', zIndex: 2 }
      ).addTo(map);
    });
    return () => { cancelled = true; };
  }, [ready, activeLayer]);

  /* ── Activa/desactiva capas GIS ── */
  function toggleGis(id: GisId) {
    const map = mapRef.current;
    const layer = gisRefs.current[id];
    const turnOn = !activeGis.has(id);
    if (map && layer) {
      if (turnOn) layer.addTo(map);
      else map.removeLayer(layer);
    }
    setActiveGis((prev) => {
      const next = new Set(prev);
      if (turnOn) next.add(id); else next.delete(id);
      return next;
    });
  }

  const currentLyr = WEATHER_LAYERS.find((l) => l.id === activeLayer) ?? null;
  const panelStyle = { background: 'var(--tw-card)', border: '1px solid var(--tw-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' };
  const chip = (active: boolean, color: string) => ({
    color: active ? color : 'var(--tw-secondary)',
    background: active ? `${color}20` : 'transparent',
    border: `1px solid ${active ? color : 'var(--tw-border)'}`,
  });

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 space-y-2" style={{ borderBottom: '1px solid var(--tw-border)' }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--tw-secondary)' }}>
              Mapa de riesgo — Tocancipá
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--tw-secondary)', opacity: 0.7 }}>
              Radar: OpenWeatherMap &nbsp;|&nbsp; Cartografía base: OpenStreetMap / Esri
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {BASE_LAYERS.map((b) => (
              <button key={b.id} onClick={() => setBase(b.id)} aria-pressed={base === b.id}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                style={chip(base === b.id, 'var(--tw-accent)')}>
                {b.label}
              </button>
            ))}
            <button onClick={() => mapRef.current?.fitBounds(HOME_BOUNDS)} title="Volver al encuadre inicial"
              className="px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1"
              style={chip(false, 'var(--tw-accent)')}>
              <Crosshair className="w-3.5 h-3.5" /> Centrar
            </button>
          </div>
        </div>

        {/* Capas meteo */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide font-medium mr-1 w-10" style={{ color: 'var(--tw-secondary)' }}>
            Radar:
          </span>
          {WEATHER_LAYERS.map((lyr) => {
            const active = activeLayer === lyr.id;
            return (
              <button key={lyr.id} aria-pressed={active}
                onClick={() => setActiveLayer(active ? null : lyr.id)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                style={chip(active, lyr.color)}>
                {lyr.label}
              </button>
            );
          })}
          {!OWM_KEY && (
            <span className="text-[10px]" style={{ color: '#b45309' }}>
              Sin NEXT_PUBLIC_OPENWEATHER_API_KEY: el radar no se muestra.
            </span>
          )}
        </div>

        {/* Capas GIS */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide font-medium mr-1 w-10" style={{ color: 'var(--tw-secondary)' }}>
            GIS:
          </span>
          {GIS_LAYERS.map((g) => {
            const on = activeGis.has(g.id);
            return (
              <button key={g.id} onClick={() => toggleGis(g.id)} aria-pressed={on}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5"
                style={chip(on, g.color)}>
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: g.color, opacity: on ? 1 : 0.35 }} />
                {g.label}
              </button>
            );
          })}
          {gisError && (
            <span className="text-[10px]" style={{ color: '#b45309' }}>No se pudo cargar alguna capa GIS.</span>
          )}
        </div>
      </div>

      {/* Mapa */}
      <div style={{ height: 520, position: 'relative' }}>
        <div ref={containerRef} style={{ height: '100%', width: '100%' }} />

        {/* Leyenda radar */}
        {currentLyr && OWM_KEY && (
          <div className="absolute bottom-8 left-3 z-[1000] px-3 py-2 rounded-lg text-xs" style={panelStyle}>
            <p className="font-semibold text-primary mb-1.5">{currentLyr.label}</p>
            <div className="space-y-1">
              {LEGENDS[currentLyr.id].map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5" style={{ color: 'var(--tw-secondary)' }}>
                  <div className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ background: color, border: '1px solid var(--tw-border)' }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leyenda GIS */}
        {activeGis.size > 0 && (
          <div className="absolute top-3 right-3 z-[1000] px-3 py-2 rounded-lg text-xs max-w-[240px]" style={panelStyle}>
            <p className="font-semibold text-primary mb-1.5">Capas de riesgo</p>
            <div className="space-y-1.5">
              {GIS_LAYERS.filter((g) => activeGis.has(g.id)).map((g) => (
                <div key={g.id} className="flex items-start gap-1.5" style={{ color: 'var(--tw-secondary)' }}>
                  <div className="w-3.5 flex-shrink-0 mt-1"
                    style={g.id === 'evacuation'
                      ? { height: 4, background: g.color, borderRadius: 2 }
                      : { height: 10, background: `${g.color}55`, border: `2px ${g.id === 'esmeralda' ? 'dashed' : 'solid'} ${g.color}`, borderRadius: 2 }} />
                  <span>{g.legend}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] mt-2 leading-snug" style={{ color: '#b45309' }}>
              Trazados de referencia, no oficiales. Toque cada elemento para ver su fuente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
