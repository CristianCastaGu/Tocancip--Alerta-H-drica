'use client';

import { useState, FormEvent } from 'react';
import { Save, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

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

interface Props {
  initial: ThresholdData;
  onSaved?: (data: ThresholdData) => void;
}

export default function ThresholdForm({ initial, onSaved }: Props) {
  const [form, setForm] = useState<ThresholdData>(initial);
  const [saving, setSaving] = useState(false);

  function setNum(key: keyof ThresholdData, val: string) {
    setForm((prev) => ({ ...prev, [key]: parseFloat(val) || 0 }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/thresholds', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      toast.success('Umbrales actualizados correctamente');
      onSaved?.(data);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      <h2 className="font-semibold text-primary">Umbrales de riesgo</h2>

      {/* Precipitación */}
      <div>
        <h3 className="text-xs uppercase tracking-wide font-medium mb-3" style={{ color: 'var(--tw-secondary)' }}>
          Precipitación (mm)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['Preventivo', 'Alerta', 'Emergencia'] as const).map((lv) => {
            const key = `precip${lv}` as keyof ThresholdData;
            const colors = { Preventivo: '#eab308', Alerta: '#f97316', Emergencia: '#ef4444' };
            return (
              <div key={lv}>
                <label className="block text-xs mb-1 font-medium" style={{ color: colors[lv] }}>{lv}</label>
                <input
                  type="number" step="0.5" min="0"
                  value={form[key] as number}
                  onChange={(e) => setNum(key, e.target.value)}
                  className="input-field font-mono"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Viento */}
      <div>
        <h3 className="text-xs uppercase tracking-wide font-medium mb-3" style={{ color: 'var(--tw-secondary)' }}>
          Velocidad de viento (km/h)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['Preventivo', 'Alerta', 'Emergencia'] as const).map((lv) => {
            const key = `wind${lv}` as keyof ThresholdData;
            const colors = { Preventivo: '#eab308', Alerta: '#f97316', Emergencia: '#ef4444' };
            return (
              <div key={lv}>
                <label className="block text-xs mb-1 font-medium" style={{ color: colors[lv] }}>{lv}</label>
                <input
                  type="number" step="1" min="0"
                  value={form[key] as number}
                  onChange={(e) => setNum(key, e.target.value)}
                  className="input-field font-mono"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Humedad y frecuencia */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs uppercase tracking-wide font-medium mb-2" style={{ color: 'var(--tw-secondary)' }}>
            Humedad mínima preventivo (%)
          </label>
          <input type="number" step="1" min="0" max="100"
            value={form.humidityPreventivo}
            onChange={(e) => setNum('humidityPreventivo', e.target.value)}
            className="input-field font-mono" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide font-medium mb-2" style={{ color: 'var(--tw-secondary)' }}>
            Frecuencia de evaluación (min)
          </label>
          <input type="number" step="1" min="1" max="1440"
            value={form.evalIntervalMinutes}
            onChange={(e) => setNum('evalIntervalMinutes', e.target.value)}
            className="input-field font-mono" />
        </div>
      </div>

      {/* Toggle agente automático */}
      <div className="flex items-center justify-between py-3 divider">
        <div>
          <p className="text-sm font-medium text-primary">Agente automático</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--tw-secondary)' }}>
            Evalúa las APIs cada {form.evalIntervalMinutes} minutos y envía alertas automáticamente.
          </p>
        </div>
        <button type="button" onClick={() => setForm((prev) => ({ ...prev, autoEnabled: !prev.autoEnabled }))}
          className="flex-shrink-0 ml-4 transition-colors">
          {form.autoEnabled
            ? <ToggleRight className="w-10 h-10 text-accent" />
            : <ToggleLeft className="w-10 h-10" style={{ color: 'var(--tw-secondary)' }} />}
        </button>
      </div>

      <button type="submit" disabled={saving}
        className="w-full btn-primary flex items-center justify-center gap-2 py-2.5">
        {saving
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</>
          : <><Save className="w-4 h-4" /> Guardar cambios</>}
      </button>
    </form>
  );
}
