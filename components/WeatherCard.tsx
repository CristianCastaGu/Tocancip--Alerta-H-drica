'use client';

import { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  unit: string;
  icon: LucideIcon;
  source?: string;
  color?: string;
  trend?: 'up' | 'down' | 'stable';
}

export default function WeatherCard({ label, value, unit, icon: Icon, source, color = '#38bdf8' }: Props) {
  return (
    <div className="card flex flex-col gap-2 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">{label}</span>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
      </div>

      <div className="flex items-baseline gap-1">
        <span className="font-mono text-3xl font-semibold" style={{ color }}>
          {typeof value === 'number' ? value.toFixed(1) : value}
        </span>
        <span className="text-slate-400 text-sm">{unit}</span>
      </div>

      {source && (
        <span className="text-xs text-slate-500 truncate">{source}</span>
      )}
    </div>
  );
}
