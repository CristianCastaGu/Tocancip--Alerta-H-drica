'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ThresholdForm from '@/components/ThresholdForm';
import { History } from 'lucide-react';

interface ThresholdData {
  precipPreventivo: number;
  precipAlerta: number;
  precipEmergencia: number;
  windPreventivo: number;
  windAlerta: number;
  windEmergencia: number;
  humidityPreventivo: number;
  evalIntervalMinutes: number;
  autoEnabled: boolean;
}

interface AuditEntry {
  id: string;
  action: string;
  detail: string | null;
  createdAt: string;
  user: { username: string };
}

export default function ConfiguracionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [thresholds, setThresholds] = useState<ThresholdData | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const userRole = (session?.user as { role?: string })?.role;

  useEffect(() => {
    if (status === 'authenticated' && userRole !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [status, userRole, router]);

  useEffect(() => {
    async function load() {
      const [thRes, auditRes] = await Promise.all([
        fetch('/api/thresholds'),
        fetch('/api/audit?action=THRESHOLD_UPDATE'),
      ]);
      const th = await thRes.json();
      const audit = await auditRes.json();
      setThresholds(th);
      setHistory(audit.logs ?? []);
      setLoading(false);
    }
    if (userRole === 'ADMIN') load();
  }, [userRole]);

  if (status === 'loading' || loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-48" />
        <div className="card h-96" />
      </div>
    );
  }

  if (userRole !== 'ADMIN') return null;

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-primary">Configuración de umbrales</h1>
        <p className="text-sm text-slate-400">Solo administradores pueden modificar estos parámetros.</p>
      </div>

      {thresholds && (
        <ThresholdForm
          initial={thresholds}
          onSaved={(updated) => setThresholds(updated)}
        />
      )}

      {/* Historial de cambios */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-primary text-sm">Historial de cambios</h2>
        </div>
        {history.length === 0 ? (
          <p className="text-slate-500 text-sm">Sin cambios registrados.</p>
        ) : (
          <div className="space-y-2">
            {history.slice(0, 10).map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-4 py-2 border-t border-slate-800 first:border-t-0">
                <div>
                  <p className="text-xs text-slate-300 font-medium">{entry.user.username}</p>
                  <p className="text-xs text-slate-500 mt-0.5 max-w-sm break-words">
                    {entry.detail ? JSON.stringify(JSON.parse(entry.detail), null, 0).slice(0, 120) : '—'}
                  </p>
                </div>
                <span className="text-xs text-slate-500 font-mono whitespace-nowrap flex-shrink-0">
                  {new Date(entry.createdAt).toLocaleString('es-CO')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
