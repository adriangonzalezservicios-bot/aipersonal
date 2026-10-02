import React from 'react';
import { X, History, Trash2, ArrowUpRight, Calendar, Sparkles, Scale } from 'lucide-react';
import { ConsensusSession } from '../types/consensus';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ConsensusSession[];
  onSelectSession: (session: ConsensusSession) => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  sessions,
  onSelectSession,
  onDeleteSession,
  onClearAll,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border-l border-slate-800 w-full max-w-md h-full flex flex-col shadow-2xl p-5 relative animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Historial de Consensos</h3>
              <p className="text-xs text-slate-400">{sessions.length} sesiones guardadas</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of Sessions */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <History className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs">Aún no hay consultas guardadas.</p>
              <p className="text-[11px] text-slate-600">
                Cada vez que ejecutes una orquestación multi-IA, se guardará aquí automáticamente.
              </p>
            </div>
          ) : (
            sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-indigo-500/40 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {new Date(sess.timestamp).toLocaleDateString()} • {new Date(sess.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 font-mono text-[10px] border border-indigo-800/40">
                      {sess.enginesUsed.length} IAs
                    </span>
                  </div>

                  <h4 className="text-xs sm:text-sm font-bold text-slate-200 line-clamp-2 mb-1 group-hover:text-indigo-300 transition-colors">
                    {sess.synthesis?.title || sess.prompt}
                  </h4>

                  <p className="text-xs text-slate-400 line-clamp-2 mb-2">
                    {sess.prompt}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
                  <button
                    onClick={() => {
                      onSelectSession(sess);
                      onClose();
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <span>Cargar Síntesis</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => onDeleteSession(sess.id)}
                    className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                    title="Eliminar de historial"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        {sessions.length > 0 && (
          <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
            <button
              onClick={onClearAll}
              className="text-red-400 hover:text-red-300 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar todo el historial</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
