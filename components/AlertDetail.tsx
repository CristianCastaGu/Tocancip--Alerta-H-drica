'use client';

import { useEffect, useState } from 'react';
import {
  X, ChevronLeft, ChevronRight, Bot, User, CheckCircle2, XCircle, RefreshCw,
  Lightbulb, Copy, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { AlertLevel, Thresholds } from '@/lib/types';
import { LEVEL_COLORS, LEVEL_LABELS, levelFromIRI } from '@/lib/riskEngine';
import { readSnapshot, explainAlert } from '@/lib/alertSnapshot';
import { buildAlertMessage } from '@/lib/alertMessage';

export interface AlertRecord {
  id: string;
  level: AlertLevel;
  triggeredBy: string;
  message: string | null;
  waStatus: string;
  waMessageId: string | null;
  weatherData: unknown;
  createdAt: string;
  user: { username: string; role: string } | null;
}

interface Props {
  alert: AlertRecord;
  thresholds: Thresholds;
  canResend: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onUpdated: (alert: AlertRecord) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  'open-meteo': 'Open-Meteo',
  openweather: 'OpenWeather',
  weatherapi: 'WeatherAPI',
  meteoblue: 'Meteoblue',
};

const STEP_COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444'];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tw-secondary)' }}>
        {title}
      </h3>
      {children}
    </section>
  );
}

/* Barra que ubica el valor medido frente a los umbrales vigentes en ese momento */
function ThresholdGauge({ label, value, unit, steps, max }: {
  label: string; value: number | undefined; unit: string; steps: number[]; max: number;
}) {
  if (value === undefined) return null;
  const scale = Math.max(max, value * 1.05);
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  const bounds = [0, ...steps, scale];
  const zone = steps.filter((s) => value >= s).length;
  const zoneNames = steps.length === 3 ? ['Normal', 'Preventivo', 'Alerta', 'Emergencia'] : ['Normal', 'Sobre el umbral'];
  const colors = steps.length === 3 ? STEP_COLORS : [STEP_COLORS[0], STEP_COLORS[1]];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-primary">{label}</span>
        <span className="text-xs font-mono">
          <span className="font-semibold text-primary">{value.toFixed(1)} {unit}</span>
          <span className="ml-2 font-sans font-medium" style={{ color: colors[zone] }}>{zoneNames[zone]}</span>
        </span>
      </div>
      <div className="relative h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--tw-elevated)' }}>
        {bounds.slice(0, -1).map((from, i) => (
          <div key={i} className="absolute top-0 h-full"
            style={{ left: pct(from), width: `calc(${pct(bounds[i + 1])} - ${pct(from)})`, background: colors[i], opacity: 0.3 }} />
        ))}
        <div className="absolute top-0 h-full w-1 rounded-full"
          style={{ left: `calc(${pct(value)} - 2px)`, background: 'var(--tw-primary)' }} />
      </div>
      <div className="relative h-3.5 mt-0.5">
        {steps.map((s, i) => (
          <span key={i} className="absolute text-[9px] font-mono -translate-x-1/2"
            style={{ left: pct(s), color: colors[i + 1] }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

export default function AlertDetail({ alert, thresholds, canResend, onClose, onPrev, onNext, onUpdated }: Props) {
  const [resending, setResending] = useState(false);
  const [confirmResend, setConfirmResend] = useState(false);

  useEffect(() => { setConfirmResend(false); }, [alert.id]);

  /* Teclado: Esc cierra, flechas navegan entre alertas */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') onPrev?.();
      else if (e.key === 'ArrowRight') onNext?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  const view = readSnapshot(alert.weatherData, thresholds);
  const t = view.thresholds;
  const v = view.values;
  const color = LEVEL_COLORS[alert.level];
  const isManual = alert.triggeredBy === 'manual';
  const when = new Date(alert.createdAt);
  const explanation = explainAlert(view, alert.level, alert.triggeredBy);
  const note = isManual ? alert.message ?? '' : '';
  const whatsappText = buildAlertMessage(alert.level, note, v, when);
  const iriColor = view.iri !== null ? LEVEL_COLORS[levelFromIRI(view.iri)] : color;
  const availableSources = view.sources.filter((s) => s.available);

  async function resend() {
    setResending(true);
    try {
      const res = await fetch(`/api/alerts/${alert.id}/resend`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo reenviar');
      onUpdated(data.alert);
      if (data.whatsapp?.success) toast.success('Alerta enviada por WhatsApp');
      else toast.error(`El envío volvió a fallar: ${data.whatsapp?.error ?? 'sin detalle'}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResending(false);
      setConfirmResend(false);
    }
  }

  async function copySummary() {
    const lines = [
      `Alerta ${LEVEL_LABELS[alert.level]} — ${when.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`,
      `Tipo: ${isManual ? `manual (${alert.user?.username ?? 'usuario'})` : 'automática'}`,
      ...explanation,
      v.precipitation !== undefined ? `Lluvia ${v.precipitation.toFixed(1)} mm/h · Humedad ${v.humidity?.toFixed(0)} % · Viento ${v.windSpeed?.toFixed(1)} km/h` : '',
      view.rainStats ? `Acumulado 72 h: ${view.rainStats.past72h.toFixed(1)} mm · Previsto 24 h: ${view.rainStats.next24h.toFixed(1)} mm` : '',
      `WhatsApp: ${alert.waStatus === 'sent' ? 'enviado' : `falló${view.waError ? ` (${view.waError})` : ''}`}`,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast.success('Resumen copiado');
    } catch {
      toast.error('No se pudo copiar');
    }
  }

  const iconBtn = 'p-1.5 rounded-lg transition-colors disabled:opacity-30 hover:bg-[var(--tw-hover)]';

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'var(--tw-overlay)' }} onClick={onClose} />

      <aside
        role="dialog" aria-modal="true" aria-label="Detalle de la alerta"
        className="fixed inset-y-0 right-0 z-50 w-full max-w-xl overflow-y-auto shadow-2xl animate-fade-in"
        style={{ background: 'var(--tw-card)', borderLeft: '1px solid var(--tw-border)' }}
      >
        {/* Encabezado */}
        <div className="sticky top-0 z-10 px-5 py-4"
          style={{ background: 'var(--tw-card)', borderBottom: '1px solid var(--tw-border)', borderTop: `3px solid ${color}` }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="risk-badge text-xs"
                  style={{ backgroundColor: `${color}18`, color, border: `1px solid ${color}50` }}>
                  {LEVEL_LABELS[alert.level]}
                </span>
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--tw-secondary)' }}>
                  {isManual ? <><User className="w-3 h-3" /> Manual · {alert.user?.username ?? 'usuario'}</> : <><Bot className="w-3 h-3" /> Automática</>}
                </span>
              </div>
              <p className="text-sm font-semibold text-primary mt-1.5">
                {when.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'full', timeStyle: 'short' })}
              </p>
            </div>
            <div className="flex items-center gap-0.5 text-primary flex-shrink-0">
              <button onClick={onPrev} disabled={!onPrev} className={iconBtn} title="Alerta más reciente (←)">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={onNext} disabled={!onNext} className={iconBtn} title="Alerta anterior (→)">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={copySummary} className={iconBtn} title="Copiar resumen">
                <Copy className="w-4 h-4" />
              </button>
              <button onClick={onClose} className={iconBtn} title="Cerrar (Esc)">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* Por qué */}
          <div className="rounded-lg p-3 flex gap-2.5" style={{ background: `${color}10`, border: `1px solid ${color}35` }}>
            <Lightbulb className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color }} />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-primary">¿Por qué se activó?</p>
              {explanation.map((line) => (
                <p key={line} className="text-xs leading-relaxed text-primary">{line}</p>
              ))}
            </div>
          </div>

          {/* Valores frente a umbrales */}
          {v.precipitation !== undefined && (
            <Section title="Valores medidos frente a los umbrales">
              <div className="space-y-3">
                <ThresholdGauge label="Intensidad de lluvia" value={v.precipitation} unit="mm/h"
                  steps={[t.precipPreventivo, t.precipAlerta, t.precipEmergencia]} max={t.precipEmergencia * 1.2} />
                <ThresholdGauge label="Viento" value={v.windSpeed} unit="km/h"
                  steps={[t.windPreventivo, t.windAlerta, t.windEmergencia]} max={t.windEmergencia * 1.2} />
                <ThresholdGauge label="Humedad relativa" value={v.humidity} unit="%"
                  steps={[t.humidityPreventivo]} max={100} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {v.temperature !== undefined && (
                  <div className="rounded-lg px-3 py-2" style={{ background: 'var(--tw-elevated)' }}>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--tw-secondary)' }}>Temperatura</p>
                    <p className="text-sm font-mono font-semibold text-primary">{v.temperature.toFixed(1)} °C</p>
                  </div>
                )}
                {v.rainProbability !== undefined && (
                  <div className="rounded-lg px-3 py-2" style={{ background: 'var(--tw-elevated)' }}>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--tw-secondary)' }}>Prob. de lluvia</p>
                    <p className="text-sm font-mono font-semibold text-primary">{v.rainProbability.toFixed(0)} %</p>
                  </div>
                )}
              </div>
              {view.reconstructed && (
                <p className="text-[10px] mt-2" style={{ color: '#b45309' }}>
                  Este registro es anterior al guardado detallado: se compara contra los umbrales actuales,
                  que pueden no ser los que regían ese día.
                  {view.singleSource && ` Los valores vienen de una sola fuente (${SOURCE_LABELS[view.singleSource] ?? view.singleSource}).`}
                </p>
              )}
            </Section>
          )}

          {/* Lluvia acumulada */}
          {view.rainStats && (
            <Section title="Lluvia acumulada y prevista">
              <div className="grid grid-cols-4 gap-2">
                {([
                  ['Últimas 24 h', view.rainStats.past24h],
                  ['Últimas 72 h', view.rainStats.past72h],
                  ['Próximas 6 h', view.rainStats.next6h],
                  ['Próximas 24 h', view.rainStats.next24h],
                ] as [string, number][]).map(([label, mm], i) => (
                  <div key={label} className="rounded-lg px-2 py-2 text-center"
                    style={{ background: 'var(--tw-elevated)', borderTop: `2px solid ${i < 2 ? '#818cf8' : '#38bdf8'}` }}>
                    <p className="text-[10px]" style={{ color: 'var(--tw-secondary)' }}>{label}</p>
                    <p className="text-sm font-mono font-semibold text-primary">{mm.toFixed(1)}</p>
                    <p className="text-[9px]" style={{ color: 'var(--tw-secondary)' }}>mm</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--tw-secondary)' }}>
                Probabilidad máxima de lluvia en las 6 h siguientes: {view.rainStats.maxProbNext6h.toFixed(0)} %
              </p>
            </Section>
          )}

          {/* IRI */}
          {view.iri !== null && view.components.length > 0 && (
            <Section title="Índice de riesgo compuesto">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-full flex flex-col items-center justify-center border-4 flex-shrink-0"
                  style={{ borderColor: iriColor, background: `${iriColor}12` }}>
                  <span className="text-lg font-bold font-mono leading-none" style={{ color: iriColor }}>{view.iri}</span>
                  <span className="text-[8px]" style={{ color: iriColor }}>/ 100</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--tw-secondary)' }}>
                  25 Preventivo · 50 Alerta · 75 Emergencia.
                  {view.calculatedLevel && <> El sistema calculaba <strong style={{ color: LEVEL_COLORS[view.calculatedLevel] }}>{LEVEL_LABELS[view.calculatedLevel]}</strong>.</>}
                </p>
              </div>
              <div className="space-y-2">
                {view.components.map((c) => (
                  <div key={c.key}>
                    <div className="flex justify-between items-center gap-2 mb-0.5 text-xs">
                      <span className="text-primary">{c.label}</span>
                      <span className="font-mono whitespace-nowrap">
                        <span style={{ color: 'var(--tw-secondary)' }}>{c.rawValue.toFixed(1)} {c.unit}</span>
                        <span className="font-semibold ml-2" style={{ color: c.color }}>
                          +{c.points.toFixed(1).replace('.', ',')} de {Math.round(c.weight)}
                        </span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--tw-elevated)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (c.points / c.weight) * 100)}%`, background: c.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Lecturas por fuente */}
          {availableSources.length > 0 && (
            <Section title={`Lectura de cada fuente (${availableSources.length} de ${view.sources.length} disponibles)`}>
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--tw-border)' }}>
                <table className="w-full text-xs">
                  <thead className="table-header">
                    <tr style={{ color: 'var(--tw-secondary)' }}>
                      {['Fuente', 'Lluvia', 'Humedad', 'Viento', 'Temp.', 'Prob.'].map((h, i) => (
                        <th key={h} className={`px-2.5 py-1.5 font-medium ${i ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.sources.map((s) => (
                      <tr key={s.source} className="table-row font-mono" style={{ color: s.available ? 'var(--tw-primary)' : 'var(--tw-secondary)' }}>
                        <td className="px-2.5 py-1.5 font-sans">{SOURCE_LABELS[s.source] ?? s.source}</td>
                        {s.available ? (
                          <>
                            <td className="px-2.5 py-1.5 text-right">{s.precipitation.toFixed(1)}</td>
                            <td className="px-2.5 py-1.5 text-right">{s.humidity.toFixed(0)} %</td>
                            <td className="px-2.5 py-1.5 text-right">{s.windSpeed.toFixed(1)}</td>
                            <td className="px-2.5 py-1.5 text-right">{s.temperature.toFixed(1)}°</td>
                            <td className="px-2.5 py-1.5 text-right">{s.rainProbability.toFixed(0)} %</td>
                          </>
                        ) : (
                          <td colSpan={5} className="px-2.5 py-1.5 text-right font-sans">sin datos en ese momento</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {/* WhatsApp */}
          <Section title="Mensaje de WhatsApp">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="flex items-center gap-1.5 text-xs">
                {alert.waStatus === 'sent'
                  ? <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-green-500 font-medium">Enviado al grupo</span></>
                  : <><XCircle className="w-4 h-4 text-red-400" /><span className="text-red-400 font-medium">No se entregó</span></>}
              </span>
              {alert.waStatus !== 'sent' && canResend && (
                confirmResend ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-[11px]" style={{ color: 'var(--tw-secondary)' }}>¿Enviar ahora al grupo?</span>
                    <button onClick={resend} disabled={resending}
                      className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1">
                      {resending ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Sí, enviar
                    </button>
                    <button onClick={() => setConfirmResend(false)} disabled={resending} className="btn-ghost text-xs py-1 px-2.5">No</button>
                  </span>
                ) : (
                  <button onClick={() => setConfirmResend(true)} className="btn-ghost text-xs py-1 px-2.5 flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3" /> Reintentar envío
                  </button>
                )
              )}
            </div>
            {alert.waStatus !== 'sent' && (
              <p className="text-[11px] mb-2 rounded-md px-2.5 py-1.5" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                Motivo: {view.waError ?? 'no quedó registrado (alerta anterior a esta función).'}
              </p>
            )}
            <pre className="text-xs whitespace-pre-wrap rounded-lg p-3 font-sans leading-relaxed text-primary"
              style={{ background: 'var(--tw-elevated)', border: '1px solid var(--tw-border)' }}>
              {whatsappText}
            </pre>
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--tw-secondary)' }}>
              Texto reconstruido con la plantilla actual y los valores guardados.
              {alert.waMessageId && ` ID de WhatsApp: ${alert.waMessageId}`}
            </p>
          </Section>
        </div>
      </aside>
    </>
  );
}
