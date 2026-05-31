'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, Filter, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Bot, User } from 'lucide-react';
import { AlertLevel } from '@/lib/types';
import { LEVEL_LABELS, LEVEL_COLORS } from '@/lib/riskEngine';

interface Alert {
  id: string;
  level: AlertLevel;
  triggeredBy: string;
  message: string | null;
  waStatus: string;
  waMessageId: string | null;
  createdAt: string;
  user: { username: string; role: string } | null;
}

export default function HistorialPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ level: '', type: '', from: '', to: '' });

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
    } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  function exportCSV() {
    const headers = ['Fecha/Hora', 'Nivel', 'Activado por', 'Usuario', 'Mensaje', 'WhatsApp', 'ID WA'];
    const rows = alerts.map((a) => [
      new Date(a.createdAt).toLocaleString('es-CO'), a.level, a.triggeredBy,
      a.user?.username ?? 'Sistema', a.message ?? '', a.waStatus, a.waMessageId ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tah-historial-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Historial de alertas</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--tw-secondary)' }}>{total} registros totales</p>
        </div>
        <button onClick={exportCSV} className="btn-ghost flex items-center gap-2 text-sm self-start sm:self-auto">
          <Download className="w-4 h-4" />Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--tw-secondary)' }}>
          <Filter className="w-3.5 h-3.5" />Filtros
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select value={filters.level}
            onChange={(e) => { setFilters((f) => ({ ...f, level: e.target.value })); setPage(1); }}
            className="select-field">
            <option value="">Todos los niveles</option>
            {(['INFORMATIVO', 'PREVENTIVO', 'ALERTA', 'EMERGENCIA'] as AlertLevel[]).map((l) => (
              <option key={l} value={l}>{LEVEL_LABELS[l]}</option>
            ))}
          </select>
          <select value={filters.type}
            onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1); }}
            className="select-field">
            <option value="">Todos los tipos</option>
            <option value="manual">Manual</option>
            <option value="auto">Automático</option>
          </select>
          <input type="date" value={filters.from}
            onChange={(e) => { setFilters((f) => ({ ...f, from: e.target.value })); setPage(1); }}
            className="input-field" />
          <input type="date" value={filters.to}
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
                {['Fecha/Hora', 'Nivel', 'Tipo', 'Activado por', 'Mensaje', 'WhatsApp'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide whitespace-nowrap"
                    style={{ color: 'var(--tw-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="table-row">
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded animate-pulse w-24" style={{ background: 'var(--tw-elevated)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--tw-secondary)' }}>
                    No hay alertas registradas con los filtros actuales.
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.id} className="table-row table-row-hover">
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
                    <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--tw-secondary)' }}>
                      {alert.message ?? '—'}
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
                ))
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
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-primary"
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tw-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30 text-primary"
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tw-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
