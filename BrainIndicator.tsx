import React from 'react';
import { BrainCircuit, Cloud, Database, WifiOff } from 'lucide-react';

interface BrainIndicatorProps {
  configured: boolean;
  connected: boolean;
  memoryCount?: number;
}

export const BrainIndicator: React.FC<BrainIndicatorProps> = ({ configured, connected, memoryCount }) => {
  const label = !configured ? 'Cerebro local' : connected ? 'Cerebro en nube' : 'Cerebro sin conexión';
  const Icon = !configured ? Database : connected ? Cloud : WifiOff;

  return (
    <div
      className={`hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold ${
        connected || !configured
          ? 'bg-slate-900 border-slate-800 text-slate-300'
          : 'bg-amber-950/30 border-amber-700/40 text-amber-300'
      }`}
      title={
        !configured
          ? 'La memoria funciona localmente. Configurá Supabase para activar memoria persistente en la nube.'
          : connected
            ? `Memoria semántica activa${typeof memoryCount === 'number' ? ` · ${memoryCount} recuerdos` : ''}.`
            : 'Supabase está configurado pero todavía no hay una sesión de nube activa.'
      }
    >
      <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />
      <Icon className="w-3 h-3" />
      <span>{label}</span>
      {connected && typeof memoryCount === 'number' && (
        <span className="px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300">{memoryCount}</span>
      )}
    </div>
  );
};
