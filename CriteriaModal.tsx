import React from 'react';
import { X, Scale, Check, ShieldCheck, Zap, Sparkles, FileText } from 'lucide-react';
import { ArbiterCriteria } from '../types/consensus';

interface CriteriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCriteria: ArbiterCriteria;
  onSelectCriteria: (crit: ArbiterCriteria) => void;
}

const CRITERIA_DETAILS: {
  id: ArbiterCriteria;
  title: string;
  badge: string;
  icon: string;
  desc: string;
  weights: { accuracy: number; depth: number; practicality: number; clarity: number };
  idealFor: string;
}[] = [
  {
    id: 'balanced',
    title: 'Criterio Equilibrado (Por Defecto)',
    badge: '360° Balance',
    icon: '⚖️',
    desc: 'Distribuye equitativamente la ponderación entre exactitud formal, aplicabilidad práctica en producción, profundidad y claridad.',
    weights: { accuracy: 30, depth: 25, practicality: 25, clarity: 20 },
    idealFor: 'La gran mayoría de consultas complejas, arquitectura, estrategias y toma de decisiones generales.',
  },
  {
    id: 'technical_rigor',
    title: 'Rigor Técnico & Lógica Pura',
    badge: 'Zero Flaws',
    icon: '🔬',
    desc: 'Prioriza la corrección matemática, consistencia lógica, auditoría de edge cases y castiga duramente cualquier asunción no justificada.',
    weights: { accuracy: 50, depth: 30, practicality: 10, clarity: 10 },
    idealFor: 'Algoritmos, demostraciones formales, auditoría de seguridad y sistemas críticos.',
  },
  {
    id: 'practical_speed',
    title: 'Pragmatismo & Velocidad de Ejecución',
    badge: 'Listo para Producción',
    icon: '⚡',
    desc: 'Prioriza soluciones inmediatas, código listo para copiar y pegar, herramientas probadas del mundo real y mínimo overhead.',
    weights: { accuracy: 25, depth: 15, practicality: 45, clarity: 15 },
    idealFor: 'Desarrollo ágil, prototipado rápido, checklists de implementación y scripts.',
  },
  {
    id: 'creative_strategy',
    title: 'Estratégico / Disruptivo',
    badge: 'Ventaja Competitiva',
    icon: '💡',
    desc: 'Premia la originalidad contraintuitiva, la visión sistémica a largo plazo y enfoques que rompen con los paradigmas habituales.',
    weights: { accuracy: 20, depth: 30, practicality: 20, clarity: 30 },
    idealFor: 'Modelos de negocio, diferenciación de mercado, naming, diseño y pensamiento lateral.',
  },
  {
    id: 'executive_brief',
    title: 'Ejecutivo & Conciso',
    badge: 'Impacto Directivo',
    icon: '📊',
    desc: 'Prioriza extrema concisión, métricas de impacto (ROI, costes, plazos) y recomendaciones estructuradas para directores.',
    weights: { accuracy: 25, depth: 15, practicality: 30, clarity: 30 },
    idealFor: 'Comités de dirección, resúmenes ejecutivos, decisiones de inversión y comunicación C-Level.',
  },
];

export const CriteriaModal: React.FC<CriteriaModalProps> = ({
  isOpen,
  onClose,
  selectedCriteria,
  onSelectCriteria,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Criterio de Arbitraje Supremo</h3>
            <p className="text-xs text-slate-400">
              Configura cómo debe ponderar y juzgar el Árbitro al calificar las respuestas y sintetizar la Mejor Variante.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {CRITERIA_DETAILS.map((crit) => {
            const isSelected = selectedCriteria === crit.id;

            return (
              <div
                key={crit.id}
                onClick={() => {
                  onSelectCriteria(crit.id);
                  onClose();
                }}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500/60 ring-1 ring-indigo-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{crit.icon}</span>
                    <h4 className="font-bold text-sm text-slate-100">{crit.title}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                      {crit.badge}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-300 mb-2 leading-relaxed">{crit.desc}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2 font-mono">
                    <span>Exac: {crit.weights.accuracy}%</span>
                    <span>Prof: {crit.weights.depth}%</span>
                    <span>Prác: {crit.weights.practicality}%</span>
                    <span>Clar: {crit.weights.clarity}%</span>
                  </div>
                  <span className="text-indigo-400 font-medium">Ideal para: {crit.idealFor}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
