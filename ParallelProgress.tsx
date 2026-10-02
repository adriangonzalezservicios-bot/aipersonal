import React, { useEffect, useState } from 'react';
import { Cpu, Brain, Zap, BookOpen, Sparkles, Sliders, CheckCircle2, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AiEngineConfig, AiResponseResult } from '../types/consensus';

interface ParallelProgressProps {
  engines: AiEngineConfig[];
  responses: Record<string, AiResponseResult>;
  stage: 'generating_responses' | 'synthesizing' | 'completed' | 'idle' | 'error';
}

export const ParallelProgress: React.FC<ParallelProgressProps> = ({
  engines,
  responses,
  stage,
}) => {
  // Reloj de 1s solo mientras se genera (para el tiempo transcurrido por motor)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stage !== 'generating_responses') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stage]);

  if (stage === 'idle' || stage === 'error') return null;

  const enabledEngines = engines.filter((e) => e.enabled);
  const completedCount = Object.values(responses).filter((r) => r.status === 'completed').length;
  const isAllEnginesDone = completedCount >= enabledEngines.length;

  const getEngineIcon = (iconName: string) => {
    switch (iconName) {
      case 'cpu':
        return <Cpu className="w-4 h-4 text-sky-400" />;
      case 'brain':
        return <Brain className="w-4 h-4 text-amber-400" />;
      case 'zap':
        return <Zap className="w-4 h-4 text-emerald-400" />;
      case 'book-open':
        return <BookOpen className="w-4 h-4 text-purple-400" />;
      case 'sparkles':
        return <Sparkles className="w-4 h-4 text-rose-400" />;
      default:
        return <Sliders className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Stage Banner */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              {stage === 'synthesizing' ? (
                <ShieldCheck className="w-5 h-5 text-indigo-400 animate-pulse" />
              ) : (
                <Sparkles className="w-5 h-5 text-indigo-400 animate-spin" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950 animate-ping" />
          </div>

          <div>
            <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              {stage === 'generating_responses' && (
                <>Fase 1/2: Generación en Paralelo de Modelos</>
              )}
              {stage === 'synthesizing' && (
                <>Fase 2/2: Árbitro Supremo Analizando & Sintetizando</>
              )}
              {stage === 'completed' && (
                <>Consenso & Variante Óptima Concluidos</>
              )}
            </h4>
            <p className="text-xs text-slate-400">
              {stage === 'generating_responses' &&
                `Obteniendo perspectivas independientes (${completedCount}/${enabledEngines.length} IAs concluidas)...`}
              {stage === 'synthesizing' &&
                'Cruzando argumentos, detectando inconsistencias y redactando la mejor variante unificada...'}
              {stage === 'completed' &&
                'Todos los modelos fueron auditados y la mejor variante está lista para revisión.'}
            </p>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="hidden sm:flex flex-col items-end gap-1">
          <span className="text-xs font-mono font-semibold text-indigo-400">
            {stage === 'synthesizing'
              ? '90%'
              : `${Math.round((completedCount / (enabledEngines.length || 1)) * 75)}%`}
          </span>
          <div className="w-28 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-500"
              style={{
                width:
                  stage === 'synthesizing'
                    ? '90%'
                    : `${(completedCount / (enabledEngines.length || 1)) * 75}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Grid of Engine Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {enabledEngines.map((engine) => {
          const res = responses[engine.id];
          const isDone = res?.status === 'completed';
          const isErr = res?.status === 'error';
          const isWorking = !isDone && !isErr;

          return (
            <div
              key={engine.id}
              className={`rounded-xl border p-3 transition-all ${
                isDone
                  ? 'bg-slate-900/90 border-slate-700/80 shadow-sm'
                  : isErr
                  ? 'bg-red-950/20 border-red-800/40 text-red-300'
                  : 'bg-slate-950/60 border-slate-800 animate-pulse'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="p-1 rounded bg-slate-800 border border-slate-700">
                    {getEngineIcon(engine.iconName)}
                  </div>
                  <span className="text-xs font-bold text-slate-200">{engine.name}</span>
                </div>

                {isDone && (
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{(res.latencyMs / 1000).toFixed(1)}s</span>
                  </span>
                )}
                {isWorking && (
                  <span className="flex items-center gap-1 text-[10px] text-indigo-400 font-medium">
                    <Clock className="w-3 h-3 animate-spin" />
                    <span className="font-mono tabular-nums">
                      {res?.startedAt ? `${Math.max(0, Math.floor((now - res.startedAt) / 1000))}s` : '...'}
                    </span>
                  </span>
                )}
                {isErr && (
                  <span className="flex items-center gap-1 text-[10px] text-red-400 font-medium">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Fallo</span>
                  </span>
                )}
              </div>

              <div className="text-[11px] text-slate-400 truncate">
                {engine.providerLabel}
              </div>
              {isDone && (
                <p className="mt-1.5 text-[10px] leading-snug text-slate-500 line-clamp-2 animate-in fade-in duration-500">
                  {res.response.replace(/[#*`>|_-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140)}
                </p>
              )}
              {isErr && res.error && (
                <p className="mt-1.5 text-[10px] leading-snug text-red-400/80 line-clamp-2">{res.error}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Synthesis stage alert bar */}
      {isAllEnginesDone && stage === 'synthesizing' && (
        <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between gap-3 text-xs text-indigo-200">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
            <span>
              <strong>Árbitro Supremo activo:</strong> Cruzando las {completedCount} respuestas, puntuando rigor y sintetizando la Mejor Variante...
            </span>
          </div>
          <span className="font-mono text-indigo-300">Ponderando criterios...</span>
        </div>
      )}
    </div>
  );
};
