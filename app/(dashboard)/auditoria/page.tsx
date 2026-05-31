'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Filter, ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditEntry {
  id: string;
  action: string;
  detail: string | null;
  createdAt: string;
  user: { username: string; role: string };
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN:            '#38bdf8',
  ALERT_MANUAL:     '#f97316',
  THRESHOLD_UPDATE: '#eab308',
};

export default function AuditoriaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ user: '', action: '' });

  const userRole = (session?.user as { role?: string })?.role;

  useEffect(() => {
    if (status === 'authenticated' && userRole !== 'ADMIN') router.replace('/dashboard');
  }, [status, userRole, router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filters.user) params.set('user', filters.user);
    if (filters.action) params.set('action', filters.action);
    try {
      const res = await fetch(`/api/audit?${params}`);
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
    } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { if (userRole === 'ADMIN') fetchLogs(); }, [userRole, fetchLogs]);

  if (userRole !== 'ADMIN') return null;

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-primary">Auditoría del sistema</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--tw-secondary)' }}>{total} eventos registrados</p>
      </div>

      {/* Filtros */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--tw-secondary)' }}>
          <Filter className="w-3.5 h-3.5" />Filtros
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="text" placeholder="Filtrar por usuario..."
            value={filters.user}
            onChange={(e) => { setFilters((f) => ({ ...f, user: e.target.value })); setPage(1); }}
            className="input-field" />
          <input type="text" placeholder="Filtrar por acción (LOGIN, ALERT_MANUAL...)"
            value={filters.action}
            onChange={(e) => { setFilters((f) => ({ ...f, action: e.target.value })); setPage(1); }}
            className="input-field" />
        </div>
      </div>

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-header">
              <tr>
                {['Timestamp', 'Usuario', 'Rol', 'Acción', 'Detalle'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide whitespace-nowrap"
                    style={{ color: 'var(--tw-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="table-row">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 rounded animate-pulse w-24" style={{ background: 'var(--tw-elevated)' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--tw-secondary)' }}>
                    No hay eventos con los filtros actuales.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actionColor = ACTION_COLORS[log.action] ?? 'var(--tw-secondary)';
                  return (
                    <tr key={log.id} className="table-row table-row-hover">
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--tw-secondary)' }}>
                        {new Date(log.createdAt).toLocaleString('es-CO')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-primary">{log.user.username}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--tw-secondary)' }}>{log.user.role}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-semibold px-2 py-1 rounded"
                          style={{ color: actionColor, backgroundColor: `color-mix(in srgb, ${actionColor} 12%, transparent)` }}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--tw-secondary)' }}>
                        {log.detail ?? '—'}
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
              Pág. {page} de {totalPages} ({total} eventos)
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
