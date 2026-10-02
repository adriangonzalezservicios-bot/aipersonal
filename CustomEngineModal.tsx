import React, { useState } from 'react';
import { X, Sparkles, Sliders, Cpu, Brain, Zap, BookOpen, ShieldCheck } from 'lucide-react';
import { AiEngineConfig } from '../types/consensus';

interface CustomEngineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveEngine: (engine: AiEngineConfig) => void;
}

export const CustomEngineModal: React.FC<CustomEngineModalProps> = ({
  isOpen,
  onClose,
  onSaveEngine,
}) => {
  const [name, setName] = useState('');
  const [badge, setBadge] = useState('Especialista');
  const [providerLabel, setProviderLabel] = useState('Enfoque a Medida');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [iconName, setIconName] = useState<AiEngineConfig['iconName']>('sparkles');

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) return;

    const newEngine: AiEngineConfig = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      badge: badge.trim() || 'A Medida',
      providerLabel: providerLabel.trim() || 'IA Personalizada',
      description: description.trim() || `Motor especializado con enfoque en ${name}.`,
      color: 'from-indigo-500/20 to-purple-600/10 border-indigo-500/40 text-indigo-400',
      accentColor: '#6366f1',
      iconName,
      systemPrompt: systemPrompt.trim(),
      temperature,
      enabled: true,
      isCustom: true,
    };

    onSaveEngine(newEngine);
    onClose();
  };

  const applyTemplate = (tpl: { name: string; badge: string; desc: string; prompt: string; temp: number }) => {
    setName(tpl.name);
    setBadge(tpl.badge);
    setProviderLabel(tpl.name);
    setDescription(tpl.desc);
    setSystemPrompt(tpl.prompt);
    setTemperature(tpl.temp);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">Diseñar IA Personalizada</h3>
            <p className="text-xs text-slate-400">
              Crea un nuevo miembro para el Jurado de IAs con tu propio rol, sesgo analítico y directivas de sistema.
            </p>
          </div>
        </div>

        {/* Quick templates */}
        <div className="mb-4 p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 space-y-2">
          <span className="text-xs font-semibold text-slate-300 block">Plantillas Rápidas:</span>
          <div className="flex flex-wrap gap-2">
            {[
              {
                name: 'CFO Avaro & Cost-Cutter',
                badge: 'Costes & ROI',
                desc: 'Auditor financiero implacable que cuestiona todo gasto superfluo.',
                prompt: 'Eres un Director Financiero (CFO) ultra conservador. Tu misión es recortar costes al máximo, encontrar gastos superfluos, exigir ROI demostrado y advertir sobre pasivos ocultos.',
                temp: 0.3,
              },
              {
                name: 'Hacker Ético & Pentester',
                badge: 'Seguridad Ofensiva',
                desc: 'Especialista en vectores de ataque, vulnerabilidades y sanitización.',
                prompt: 'Eres un especialista en ciberseguridad y pentesting. Tu objetivo es encontrar fallas de seguridad, inyecciones, fuga de datos, debilidades de autenticación y vectores de ataque en la propuesta.',
                temp: 0.2,
              },
              {
                name: 'Abogado Corporativo',
                badge: 'Compliance & Riesgos',
                desc: 'Foco en propiedad intelectual, GDPR, contratos y responsabilidad legal.',
                prompt: 'Eres un asesor legal y de compliance de élite. Tu misión es evaluar implicaciones contractuales, propiedad intelectual, privacidad de datos, normativas internacionales y riesgos regulatorios.',
                temp: 0.3,
              },
            ].map((tpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyTemplate(tpl)}
                className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                + {tpl.name}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nombre de la IA:
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Auditor de Accesibilidad UX"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Distintivo / Badge:
              </label>
              <input
                type="text"
                value={badge}
                onChange={(e) => setBadge(e.target.value)}
                placeholder="Ej. UX & WCAG 2.1"
                className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Breve descripción del rol:
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Examina la usabilidad, contrastes y experiencia para personas con discapacidades."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Prompt de Sistema (Instrucciones maestras para esta IA):
            </label>
            <textarea
              required
              rows={4}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Define cómo debe pensar, qué debe buscar, qué tono usar y qué tipo de soluciones debe priorizar..."
              className="w-full rounded-xl bg-slate-950 border border-slate-800 p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono resize-y"
            />
          </div>

          {/* Temperature slider */}
          <div>
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="font-semibold text-slate-300">Temperatura / Creatividad:</span>
              <span className="font-mono text-indigo-400 font-bold">{temperature.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>0.1 (Máximo determinismo y rigor)</span>
              <span>1.2 (Máxima creatividad y soltura)</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/30"
            >
              Integrar al Jurado
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
