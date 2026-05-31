'use client';

import { AlertLevel } from '@/lib/types';
import { LEVEL_LABELS, LEVEL_COLORS, LEVEL_DESCRIPTIONS } from '@/lib/riskEngine';
import { Bot, User } from 'lucide-react';

interface Props {
  level: AlertLevel;
  triggeredBy?: 'manual' | 'auto';
  className?: string;
}

const LEVELS: AlertLevel[] = ['INFORMATIVO', 'PREVENTIVO', 'ALERTA', 'EMERGENCIA'];

export default function RiskSemaphore({ level, triggeredBy = 'auto', className = '' }: Props) {
  const isEmergencia = level === 'EMERGENCIA';

  return (
    <div className={`card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
          Nivel de Riesgo
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          {triggeredBy === 'manual' ? (
            <><User className="w-3 h-3" /> Manual</>
          ) : (
            <><Bot className="w-3 h-3" /> Automático</>
          )}
        </span>
      </div>

      {/* Semáforo vertical */}
      <div className="flex flex-col items-center gap-3 py-2">
        {LEVELS.slice().reverse().map((l) => {
          const isActive = l === level;
          const color = LEVEL_COLORS[l];

          return (
            <div key={l} className="flex items-center gap-4 w-full max-w-xs">
              <div
                className={`relative w-12 h-12 rounded-full flex-shrink-0 transition-all duration-500 ${
                  isActive ? 'shadow-lg' : 'opacity-20'
                } ${isActive && isEmergencia ? 'animate-pulse' : ''}`}
                style={{
                  backgroundColor: isActive ? color : color,
                  boxShadow: isActive ? `0 0 24px ${color}60` : 'none',
                }}
              />
              <div className={`transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-30'}`}>
                <p
                  className="font-bold text-sm"
                  style={{ color: isActive ? color : '#94a3b8' }}
                >
                  {LEVEL_LABELS[l]}
                </p>
                {isActive && (
                  <p className="text-xs text-slate-400 mt-0.5 max-w-[200px]">
                    {LEVEL_DESCRIPTIONS[l]}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Nivel activo grande */}
      <div
        className="mt-4 rounded-lg px-4 py-3 text-center font-bold text-lg border transition-all duration-500"
        style={{
          backgroundColor: `${LEVEL_COLORS[level]}15`,
          borderColor: `${LEVEL_COLORS[level]}40`,
          color: LEVEL_COLORS[level],
        }}
      >
        {LEVEL_LABELS[level].toUpperCase()}
      </div>
    </div>
  );
}
