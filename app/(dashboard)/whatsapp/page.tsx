'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MessageCircle, QrCode, RefreshCw, LogOut, Send, Loader2, CheckCircle2, XCircle, Users, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

type ConnState = 'open' | 'connecting' | 'close' | 'unknown';

interface WhatsAppGroup {
  id: string;
  subject: string;
  size?: number;
}

export default function WhatsAppPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const userRole = (session?.user as { role?: string })?.role;

  const [state, setState] = useState<ConnState>('unknown');
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [qr, setQr] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [testText, setTestText] = useState('Mensaje de prueba — Sistema TAH Tocancipá');
  const [sendingTest, setSendingTest] = useState(false);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && userRole !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [status, userRole, router]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      if (res.ok) {
        setState(data.state ?? 'unknown');
        if (data.state === 'open') setQr(null);
      }
    } catch {
      setState('unknown');
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (userRole !== 'ADMIN') return;
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [userRole, fetchStatus]);

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al generar el código QR');

      if (data.connected) {
        toast.success('WhatsApp ya está conectado');
        setState('open');
        setQr(null);
      } else if (data.base64) {
        setQr(data.base64);
        setState('connecting');
      } else {
        toast.error('No se recibió un código QR. Intenta de nuevo.');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm('¿Cerrar la sesión de WhatsApp? Deberás escanear el QR nuevamente.')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al cerrar sesión');
      toast.success('Sesión de WhatsApp cerrada');
      setState('close');
      setQr(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleLoadGroups() {
    setLoadingGroups(true);
    try {
      const res = await fetch('/api/whatsapp/groups');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al obtener los grupos');
      setGroups(data.groups ?? []);
      setGroupsLoaded(true);
      if ((data.groups ?? []).length === 0) {
        toast('No se encontraron grupos para este número.');
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoadingGroups(false);
    }
  }

  async function handleCopyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      toast.error('No se pudo copiar el ID');
    }
  }

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    setSendingTest(true);
    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: testNumber, text: testText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar el mensaje');
      toast.success('Mensaje de prueba enviado');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSendingTest(false);
    }
  }

  if (status === 'loading' || loadingStatus) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-800 rounded w-48" />
        <div className="card h-96" />
      </div>
    );
  }

  if (userRole !== 'ADMIN') return null;

  const statusMeta: Record<ConnState, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
    open:       { label: 'Conectado',    color: '#22c55e', Icon: CheckCircle2 },
    connecting: { label: 'Conectando…',  color: '#eab308', Icon: Loader2 },
    close:      { label: 'Desconectado', color: '#ef4444', Icon: XCircle },
    unknown:    { label: 'Desconocido',  color: '#64748b', Icon: XCircle },
  };
  const { label, color, Icon } = statusMeta[state];

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-accent" />
          WhatsApp — Evolution API
        </h1>
        <p className="text-sm" style={{ color: 'var(--tw-secondary)' }}>
          Gestiona la conexión de WhatsApp usada para enviar alertas. Corre sobre una
          instancia propia de Evolution API (no requiere aprobación de Meta Business).
        </p>
      </div>

      {/* Estado de conexión */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-primary text-sm">Estado de la instancia</h2>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
            <Icon className={`w-4 h-4 ${state === 'connecting' ? 'animate-spin' : ''}`} style={{ color }} />
            <span className="text-xs font-semibold" style={{ color }}>{label}</span>
          </div>
        </div>

        {state !== 'open' && (
          <div className="flex flex-col items-center gap-4 py-4">
            {qr ? (
              <>
                <div className="p-3 bg-white rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="Código QR de WhatsApp" className="w-56 h-56" />
                </div>
                <p className="text-xs text-center max-w-xs" style={{ color: 'var(--tw-secondary)' }}>
                  Abre WhatsApp → Dispositivos vinculados → Vincular un dispositivo, y escanea este código.
                  Se actualiza el estado automáticamente al conectar.
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6">
                <QrCode className="w-10 h-10" style={{ color: 'var(--tw-secondary)' }} />
                <p className="text-sm" style={{ color: 'var(--tw-secondary)' }}>
                  No hay una sesión activa. Genera un código QR para vincular WhatsApp.
                </p>
              </div>
            )}
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="btn-primary flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-50"
            >
              {connecting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando QR...</>
                : <><RefreshCw className="w-4 h-4" /> {qr ? 'Regenerar QR' : 'Generar código QR'}</>}
            </button>
          </div>
        )}

        {state === 'open' && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm" style={{ color: 'var(--tw-secondary)' }}>
              WhatsApp está vinculado y listo para enviar alertas.
            </p>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="btn-ghost flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-50"
              style={{ color: '#f87171' }}
            >
              {disconnecting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <LogOut className="w-4 h-4" />}
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {/* Grupos de WhatsApp */}
      {state === 'open' && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-primary text-sm flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: 'var(--tw-secondary)' }} />
              Grupos de WhatsApp
            </h2>
            <button
              onClick={handleLoadGroups}
              disabled={loadingGroups}
              className="btn-ghost flex items-center gap-2 text-xs py-1.5 px-3 disabled:opacity-50"
            >
              {loadingGroups
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCw className="w-3.5 h-3.5" />}
              {groupsLoaded ? 'Actualizar' : 'Cargar grupos'}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--tw-secondary)' }}>
            Lista los grupos de los que este número hace parte, para copiar su ID y usarlo como
            destinatario (en vez de un número individual) al enviar mensajes o alertas.
          </p>

          {groupsLoaded && groups.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--tw-secondary)' }}>
              Este número no pertenece a ningún grupo todavía.
            </p>
          )}

          {groups.length > 0 && (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between gap-3 rounded-lg p-3"
                  style={{ background: 'var(--tw-elevated)', border: '1px solid var(--tw-border)' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{group.subject}</p>
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--tw-secondary)' }}>
                      {group.id}{group.size ? ` · ${group.size} miembros` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleCopyId(group.id)}
                      className="btn-ghost flex items-center gap-1.5 text-xs py-1.5 px-2.5"
                    >
                      {copiedId === group.id
                        ? <><Check className="w-3.5 h-3.5 text-green-400" /> Copiado</>
                        : <><Copy className="w-3.5 h-3.5" /> Copiar ID</>}
                    </button>
                    <button
                      onClick={() => setTestNumber(group.id)}
                      className="btn-primary text-xs py-1.5 px-2.5"
                    >
                      Usar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mensaje de prueba */}
      <form onSubmit={handleSendTest} className="card space-y-4">
        <h2 className="font-semibold text-primary text-sm">Enviar mensaje de prueba</h2>
        <div>
          <label className="text-xs font-medium mb-1.5 block uppercase tracking-wide" style={{ color: 'var(--tw-secondary)' }}>
            Número o ID de grupo
          </label>
          <input
            type="text"
            value={testNumber}
            onChange={(e) => setTestNumber(e.target.value)}
            placeholder="573001234567 o 120363047758479522@g.us"
            className="input-field"
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium mb-1.5 block uppercase tracking-wide" style={{ color: 'var(--tw-secondary)' }}>
            Mensaje
          </label>
          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={3}
            className="input-field resize-none"
            required
          />
        </div>
        <button
          type="submit"
          disabled={sendingTest || state !== 'open'}
          className="btn-primary flex items-center gap-2 text-sm py-2 px-4 disabled:opacity-50"
        >
          {sendingTest
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            : <><Send className="w-4 h-4" /> Enviar prueba</>}
        </button>
        {state !== 'open' && (
          <p className="text-xs" style={{ color: 'var(--tw-secondary)' }}>
            Vincula WhatsApp primero para poder enviar mensajes de prueba.
          </p>
        )}
      </form>
    </div>
  );
}
