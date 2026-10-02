import React, { useState } from 'react';
import { 
  Sparkles, 
  ArrowRight,
  SlidersHorizontal,
  ChevronDown,
  Paperclip
} from 'lucide-react';
import { ArbiterCriteria, AttachedFile, AiEngineConfig } from '../types/consensus';
import { FileAttachmentZone } from './FileAttachmentZone';

interface PromptConsoleProps {
  prompt: string;
  onPromptChange: (val: string) => void;
  files: AttachedFile[];
  onAddFiles: (newFiles: AttachedFile[]) => void;
  onRemoveFile: (id: string) => void;
  criteria: ArbiterCriteria;
  onCriteriaChange: (val: ArbiterCriteria) => void;
  engines: AiEngineConfig[];
  onToggleEngine: (id: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

const CRITERIA_OPTIONS: { id: ArbiterCriteria; label: string }[] = [
  { id: 'balanced', label: 'Equilibrado' },
  { id: 'technical_rigor', label: 'Rigor Técnico' },
  { id: 'practical_speed', label: 'Pragmático & Ágil' },
  { id: 'creative_strategy', label: 'Estratégico' },
  { id: 'executive_brief', label: 'Ejecutivo' },
];

export const PromptConsole: React.FC<PromptConsoleProps> = ({
  prompt,
  onPromptChange,
  files,
  onAddFiles,
  onRemoveFile,
  criteria,
  onCriteriaChange,
  engines,
  onToggleEngine,
  onSubmit,
  onCancel,
  isProcessing,
}) => {
  const [showEngineToggle, setShowEngineToggle] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (prompt.trim() && !isProcessing) {
        onSubmit();
      }
    }
  };

  const enabledEngines = engines.filter((e) => e.enabled);

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      {/* Main Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative space-y-3">
        {/* Main Textarea */}
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hacé cualquier pregunta, solicitud o búsqueda. La app consulta en simultáneo a varios especialistas y te devuelve la mejor respuesta..."
            rows={4}
            disabled={isProcessing}
            className="w-full rounded-xl bg-slate-950 border border-slate-700/80 p-3.5 text-sm sm:text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-y leading-relaxed"
          />

          <div className="text-[11px] text-slate-500 absolute bottom-3 right-3 hidden sm:block pointer-events-none">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[10px] text-slate-400">
              Ctrl + Enter
            </kbd>
          </div>
        </div>

        {/* File Attachment Dropzone */}
        <FileAttachmentZone
          files={files}
          onAddFiles={onAddFiles}
          onRemoveFile={onRemoveFile}
          disabled={isProcessing}
        />

        {/* Toolbar & Execution Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs">
          {/* Models and Criteria Selector */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Criteria Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs">Criterio:</span>
              <select
                value={criteria}
                onChange={(e) => onCriteriaChange(e.target.value as ArbiterCriteria)}
                disabled={isProcessing}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                {CRITERIA_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Top AIs indicator & toggle button */}
            <button
              type="button"
              onClick={() => setShowEngineToggle(!showEngineToggle)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
            >
              <span>{enabledEngines.length} IAs activas</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showEngineToggle ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Action Button */}
          {isProcessing ? (
            <button
              onClick={onCancel}
              type="button"
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg bg-rose-600/90 hover:bg-rose-500 text-white shadow-rose-600/20"
            >
              <span className="w-2 h-2 rounded-full bg-white" />
              <span>Cancelar consulta</span>
            </button>
          ) : (
            <button
              onClick={onSubmit}
              disabled={!prompt.trim() || enabledEngines.length === 0}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                !prompt.trim() || enabledEngines.length === 0
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 hover:scale-[1.01] active:scale-[0.99]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Buscar & Obtener Mejor Respuesta</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapsible Model Selector Drawer */}
        {showEngineToggle && (
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
            <span className="font-semibold text-slate-300 block">
              Elegí qué IAs consultarán la pregunta en simultáneo:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {engines.map((eng) => (
                <button
                  key={eng.id}
                  type="button"
                  onClick={() => onToggleEngine(eng.id)}
                  className={`p-2 rounded-lg border text-left flex items-center justify-between transition-all ${
                    eng.enabled
                      ? 'bg-indigo-600/10 border-indigo-500/40 text-white font-medium'
                      : 'bg-slate-900/50 border-slate-800/80 text-slate-500'
                  }`}
                >
                  <span className="truncate">{eng.name}</span>
                  <span className={`w-2 h-2 rounded-full ${eng.enabled ? 'bg-indigo-400' : 'bg-slate-700'}`} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
