'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  Download, Filter, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Bot, User,
  CloudRain, Droplets, Wind,
} from 'lucide-react';
import { AlertLevel, Thresholds } from '@/lib/types';
import { LEVEL_LABELS, LEVEL_COLORS, DEFAULT_THRESHOLDS } from '@/lib/riskEngine';
import { readSnapshot } from '@/lib/alertSnapshot';
import AlertDetail, { AlertRecord } from '@/components/AlertDetail';

interface Stats {
  byLevel: Partial<Record<AlertLevel, number>>;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

const LEVELS: AlertLevel[] = ['INFORMATIVO', 'PREVENTIVO', 'ALERTA', 'EMERGENCIA'];

export default function HistorialPage() {
  const { data: session } = useSession();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ level: '', type: '', from: '', to: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);

  const userRole = (session?.user as { role?: string })?.role ?? 'VISOR';
  const canResend = ['ADMIN', 'OPERADOR'].includes(userRole);

  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filters.level) params.set('level', filters.level);
    if (filters.type) params.set('type', filters.type);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    try {
      const res = await fetch(`/api/alerts/history?${params}`);
      const data = await res.json();
      setAlerts(data.alerts ?? []);
      setTotal(data.total ?? 0);
      setStats(data.stats ?? null);
    } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  /* Umbrales actuales: solo se usan para reconstruir registros que no guardaron los suyos */
  useEffect(() => {
    fetch('/api/thresholds')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setThresholds(data); })
      .catch(() => { /* se mantienen los umbrales por defecto */ });
  }, []);

  const selectedIndex = alerts.findIndex((a) => a.id === selectedId);
  const selected = selectedIndex >= 0 ? alerts[selectedIndex] : null;

  function exportCSV() {
    const headers = [
      'Fecha/Hora', 'Nivel', 'Activado por', 'Usuario', 'Mensaje', 'WhatsApp', 'ID WA',
      'Lluvia (mm/h)', 'Humedad (%)', 'Viento (km/h)', 'Temperatura (°C)', 'Prob. lluvia (%)',
      'IRI', 'Lluvia 72 h (mm)', 'Lluvia prevista 24 h (mm)', 'Error WhatsApp',
    ];
    const n = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? '' : v.toFixed(d));
    const rows = alerts.map((a) => {
      const s = readSnapshot(a.weatherData, thresholds);
      return [
        new Date(a.createdAt).toLocaleString('es-CO'), a.level, a.triggeredBy,
        a.user?.username ?? 'Sistema', a.message ?? '', a.waStatus, a.waMessageId ?? '',
        n(s.values.precipitation), n(s.values.humidity, 0), n(s.values.windSpeed), n(s.values.temperature),
        n(s.values.rainProbability, 0), n(s.iri, 0), n(s.rainStats?.past72h), n(s.rainStats?.next24h),
        s.waError ?? '',
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    /* BOM para que Excel abra las tildes correctamente */
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tah-historial-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const sent = stats?.byStatus.sent ?? 0;
  const failed = stats?.byStatus.failed ?? 0;
  const deliveryRate = sent + failed > 0 ? Math.round((sent / (sent + failed)) * 100) : null;
  const columns = ['Fecha/Hora', 'Nivel', 'Tipo', 'Activado por', 'Condiciones', 'Mensaje', 'WhatsApp'];

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Historial de alertas</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--tw-secondary)' }}>
            {total} registros · haz clic en una alerta para ver qué la activó
          </p>
        </div>
        <button onClick={exportCSV} className="btn-ghost flex items-center gap-2 text-sm self-start sm:self-auto">
          <Download className="w-4 h-4" />Exportar CSV
        </button>
      </div>

      {/* Resumen del periodo filtrado */}
      {stats && total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="card lg:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tw-secondary)' }}>
              Alertas por nivel
            </p>
            <div className="flex h-3 rounded-full overflow-hidden mb-2.5" style={{ background: 'var(--tw-elevated)' }}>
              {LEVELS.map((l) => {
                const count = stats.byLevel[l] ?? 0;
                return count ? (
                  <div key={l} title={`${LEVEL_LABELS[l]}: ${count}`}
                    style={{ width: `${(count / total) * 100}%`, background: LEVEL_COLORS[l] }} />
                ) : null;
              })}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {LEVELS.map((l) => (
                <button key={l}
                  onClick={() => { setFilters((f) => ({ ...f, level: f.level === l ? '' : l })); setPage(1); }}
                  className="flex items-center gap-1.5 text-xs transition-opacity"
                  style={{ opacity: filters.level && filters.level !== l ? 0.45 : 1 }}
                  title="Filtrar por este nivel">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: LEVEL_COLORS[l] }} />
                  <span className="text-primary">{LEVEL_LABELS[l]}</span>
                  <span className="font-mono font-semibold" style={{ color: LEVEL_COLORS[l] }}>{stats.byLevel[l] ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--tw-secondary)' }}>
                Entrega WhatsApp
              </p>
              <p className="text-2xl font-mono font-semibold"
                style={{ color: deliveryRate === null ? 'var(--tw-secondary)' : deliveryRate >= 90 ? '#22c55e' : deliveryRate >= 60 ? '#eab308' : '#ef4444' }}>
                {deliveryRate === null ? '—' : `${deliveryRate} %`}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--tw-secondary)' }}>{sent} enviadas · {failed} fallidas</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--tw-secondary)' }}>
                Origen
              </p>
              <p className="text-xs flex items-center gap-1.5 text-primary mt-1.5">
                <User className="w-3.5 h-3.5" /> Manuales <span className="font-mono font-semibold ml-auto">{stats.byType.manual ?? 0}</span>
              </p>
              <p className="text-xs flex items-center gap-1.5 text-primary mt-1">
                <Bot className="w-3.5 h-3.5" /> Automáticas <span className="font-mono font-semibold ml-auto">{stats.byType.auto ?? 0}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--tw-secondary)' }}>
          <Filter className="w-3.5 h-3.5" />Filtros
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select value={filters.level} aria-label="Nivel"
            onChange={(e) => { setFilters((f) => ({ ...f, level: e.target.value })); setPage(1); }}
            className="select-field">
            <option value="">Todos los niveles</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
            ))}
          </select>
          <select value={filters.type} aria-label="Tipo"
            onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1); }}
            className="select-field">
            <option value="">Todos los tipos</option>
            <option value="manual">Manual</option>
            <option value="auto">Automático</option>
          </select>
          <input type="date" value={filters.from} aria-label="Desde"
            onChange={(e) => { setFilters((f) => ({ ...f, from: e.target.value })); setPage(1); }}
            className="input-field" />
          <input type="date" value={filters.to} aria-label="Hasta"
            onChange={(e) => { setFilters((f) => ({ ...f, to: e.target.value })); setPage(1); }}
            className="input-field" />
        </div>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-header">
              <tr>
                {columns.map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide whitespace-nowrap"
                    style={{ color: 'var(--tw-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="table-row">
                    {columns.map((c) => (
                      <td key={c} className="px-4 py-3">
                        <div className="h-4 rounded animate-pulse w-24" style={{ background: 'var(--tw-elevated)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--tw-secondary)' }}>
                    No hay alertas registradas con los filtros actuales.
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => {
                  const snap = readSnapshot(alert.weatherData, thresholds);
                  const v = snap.values;
                  return (
                    <tr key={alert.id}
                      className="table-row cursor-pointer"
                      tabIndex={0}
                      aria-label={`Ver detalle de la alerta ${LEVEL_LABELS[alert.level]}`}
                      style={alert.id === selectedId ? { background: 'var(--tw-table-row)' } : undefined}
                      onClick={() => setSelectedId(alert.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(alert.id); } }}>
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--tw-secondary)' }}>
                        {new Date(alert.createdAt).toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="risk-badge text-xs"
                          style={{
                            backgroundColor: `${LEVEL_COLORS[alert.level]}15`,
                            color: LEVEL_COLORS[alert.level],
                            border: `1px solid ${LEVEL_COLORS[alert.level]}40`,
                          }}>
                          {LEVEL_LABELS[alert.level]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--tw-secondary)' }}>
                          {alert.triggeredBy === 'manual'
                            ? <><User className="w-3 h-3" /> Manual</>
                            : <><Bot className="w-3 h-3" /> Auto</>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-primary">{alert.user?.username ?? 'Sistema'}</td>
                      <td className="px-4 py-3 text-xs font-mono whitespace-nowrap" style={{ color: 'var(--tw-secondary)' }}>
                        {v.precipitation === undefined ? '—' : (
                          <span className="flex items-center gap-2.5">
                            <span className="flex items-center gap-1" title="Intensidad de lluvia"><CloudRain className="w-3 h-3" />{v.precipitation.toFixed(1)}</span>
                            <span className="flex items-center gap-1" title="Humedad"><Droplets className="w-3 h-3" />{v.humidity?.toFixed(0)}%</span>
                            <span className="flex items-center gap-1" title="Viento km/h"><Wind className="w-3 h-3" />{v.windSpeed?.toFixed(0)}</span>
                            {snap.iri !== null && <span className="text-primary" title="Índice de riesgo compuesto">IRI {snap.iri}</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-[220px] truncate" style={{ color: 'var(--tw-secondary)' }}>
                        {alert.message || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs">
                          {alert.waStatus === 'sent'
                            ? <><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /><span className="text-green-500">Enviado</span></>
                            : alert.waStatus === 'failed'
                            ? <><XCircle className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400">Falló</span></>
                            : <span style={{ color: 'var(--tw-secondary)' }}>Pendiente</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 divider">
            <span className="text-xs" style={{ color: 'var(--tw-secondary)' }}>
              Pág. {page} de {totalPages} ({total} registros)
            </span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                aria-label="Página anterior"
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-primary hover:bg-[var(--tw-hover)]">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                aria-label="Página siguiente"
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-primary hover:bg-[var(--tw-hover)]">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <AlertDetail
          alert={selected}
          thresholds={thresholds}
          canResend={canResend}
          onClose={() => setSelectedId(null)}
          onPrev={selectedIndex > 0 ? () => setSelectedId(alerts[selectedIndex - 1].id) : undefined}
          onNext={selectedIndex < alerts.length - 1 ? () => setSelectedId(alerts[selectedIndex + 1].id) : undefined}
          onUpdated={(updated) => {
            setAlerts((list) => list.map((a) => (a.id === updated.id ? updated : a)));
            fetchAlerts();
          }}
        />
      )}
    </div>
  );
}
