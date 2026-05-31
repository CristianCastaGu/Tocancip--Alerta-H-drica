'use client';

import { useState } from 'react';
import { X, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { AlertLevel, WeatherData } from '@/lib/types';
import { LEVEL_LABELS, LEVEL_COLORS, LEVEL_DESCRIPTIONS } from '@/lib/riskEngine';
import toast from 'react-hot-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  weatherData: Partial<WeatherData>;
}

const LEVELS: AlertLevel[] = ['INFORMATIVO', 'PREVENTIVO', 'ALERTA', 'EMERGENCIA'];

export default function AlertModal({ isOpen, onClose, onSuccess, weatherData }: Props) {
  const [selectedLevel, setSelectedLevel] = useState<AlertLevel>('PREVENTIVO');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const previewText =
    `${LEVEL_LABELS[selectedLevel].toUpperCase()} — TAH Tocancipá\n` +
    `Precipitación: ${weatherData.precipitation?.toFixed(1) ?? 'N/D'} mm | ` +
    `Humedad: ${weatherData.humidity?.toFixed(0) ?? 'N/D'}% | ` +
    `Viento: ${weatherData.windSpeed?.toFixed(1) ?? 'N/D'} km/h\n` +
    (message ? `Mensaje: ${message}` : 'Sin mensaje adicional.');

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch('/api/alerts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: selectedLevel, message, weatherData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al enviar alerta');
      toast.success(`Alerta ${LEVEL_LABELS[selectedLevel]} enviada correctamente`);
      onSuccess?.();
      onClose();
      setMessage('');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Backdrop fijo — independiente del scroll */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'var(--tw-overlay)' }}
        onClick={onClose}
      />

      {/* Overlay scrollable — maneja el scroll cuando el modal es más alto que la pantalla */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">

          {/* Card del modal */}
          <div
            className="relative w-full max-w-md rounded-xl shadow-2xl"
            style={{ background: 'var(--tw-card)', border: '1px solid var(--tw-border)' }}
            onClick={(e) => e.stopPropagation()}
          >

            {/* ── HEADER ── */}
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--tw-border)' }}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <h2 className="font-semibold text-primary">Activar alerta manual</h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--tw-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tw-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ── BODY ── */}
            <div className="px-5 py-4 space-y-4">

              {/* Selector de nivel */}
              <div>
                <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--tw-secondary)' }}>
                  Nivel de alerta
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {LEVELS.map((level) => (
                    <button
                      key={level}
                      onClick={() => setSelectedLevel(level)}
                      className="py-3 px-3 rounded-lg text-sm font-semibold border transition-all"
                      style={{
                        borderColor: LEVEL_COLORS[level],
                        color: LEVEL_COLORS[level],
                        backgroundColor: selectedLevel === level ? `${LEVEL_COLORS[level]}18` : 'transparent',
                        opacity: selectedLevel === level ? 1 : 0.55,
                        transform: selectedLevel === level ? 'scale(1.02)' : 'scale(1)',
                        boxShadow: selectedLevel === level ? `0 0 0 1px ${LEVEL_COLORS[level]}40` : 'none',
                      }}
                    >
                      {LEVEL_LABELS[level]}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--tw-secondary)' }}>
                  {LEVEL_DESCRIPTIONS[selectedLevel]}
                </p>
              </div>

              {/* Datos meteorológicos */}
              <div
                className="rounded-lg p-3 grid grid-cols-3 gap-2 text-center"
                style={{ background: 'var(--tw-elevated)', border: '1px solid var(--tw-border)' }}
              >
                <div>
                  <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--tw-secondary)' }}>Precipitación</p>
                  <p className="text-sm font-semibold text-primary">{weatherData.precipitation?.toFixed(1) ?? 'N/D'} mm</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--tw-secondary)' }}>Humedad</p>
                  <p className="text-sm font-semibold text-primary">{weatherData.humidity?.toFixed(0) ?? 'N/D'}%</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: 'var(--tw-secondary)' }}>Viento</p>
                  <p className="text-sm font-semibold text-primary">{weatherData.windSpeed?.toFixed(1) ?? 'N/D'} km/h</p>
                </div>
              </div>

              {/* Mensaje adicional */}
              <div>
                <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--tw-secondary)' }}>
                  Mensaje adicional (opcional)
                </p>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="Descripción de la situación..."
                  className="input-field resize-none"
                />
                <p className="text-xs text-right mt-1" style={{ color: 'var(--tw-secondary)' }}>
                  {message.length}/300
                </p>
              </div>

              {/* Preview WhatsApp */}
              <div
                className="rounded-lg p-3"
                style={{ background: 'var(--tw-elevated)', border: '1px solid var(--tw-border)' }}
              >
                <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--tw-secondary)' }}>
                  Preview mensaje WhatsApp
                </p>
                <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-primary">
                  {previewText}
                </pre>
              </div>
            </div>

            {/* ── FOOTER ── */}
            <div
              className="flex gap-3 px-5 py-4"
              style={{ borderTop: '1px solid var(--tw-border)' }}
            >
              <button onClick={onClose} className="flex-1 btn-ghost text-sm py-2.5">
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 flex items-center justify-center gap-2 font-semibold text-sm py-2.5 rounded-lg transition-all disabled:opacity-50"
                style={{ backgroundColor: LEVEL_COLORS[selectedLevel], color: '#0f172a' }}
              >
                {sending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  : <><Send className="w-4 h-4" /> Confirmar alerta</>}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
