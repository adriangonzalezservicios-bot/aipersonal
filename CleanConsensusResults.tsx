import React, { useState } from 'react';
import { 
  Sparkles, 
  Copy, 
  Check, 
  Download, 
  Send, 
  MessageSquare, 
  CheckCircle2, 
  HelpCircle, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  FileText,
  RotateCcw
} from 'lucide-react';
import { 
  MasterSynthesis, 
  AiResponseResult, 
  AiEngineConfig, 
  AttachedFile 
} from '../types/consensus';
import { MarkdownRenderer } from './MarkdownRenderer';
import { FileAttachmentZone } from './FileAttachmentZone';

interface CleanConsensusResultsProps {
  synthesis: MasterSynthesis;
  responses: Record<string, AiResponseResult>;
  engines: AiEngineConfig[];
  originalPrompt: string;
  onFollowupQuestion: (question: string, files?: AttachedFile[]) => Promise<string>;
  onReset: () => void;
}

export const CleanConsensusResults: React.FC<CleanConsensusResultsProps> = ({
  synthesis,
  responses,
  engines,
  originalPrompt,
  onFollowupQuestion,
  onReset,
}) => {
  const [selectedView, setSelectedView] = useState<'master' | string>('master');
  const [copied, setCopied] = useState(false);
  const [showAnalysisDetails, setShowAnalysisDetails] = useState(false);

  // Follow-up state
  const [followupText, setFollowupText] = useState('');
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupFiles, setFollowupFiles] = useState<AttachedFile[]>([]);
  const [followupChat, setFollowupChat] = useState<Array<{ q: string; a: string }>>([]);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    let md = `# ${synthesis.title}\n\n`;
    md += `> **Veredicto:** ${synthesis.verdictSummary}\n\n`;
    md += `## La Mejor Respuesta (Síntesis de Consenso)\n\n${synthesis.finalMasterResponse}\n\n`;
    if (synthesis.actionPlan?.length > 0) {
      md += `### Plan de Acción Recomendado\n\n`;
      synthesis.actionPlan.forEach((step, i) => {
        md += `${i + 1}. ${step}\n`;
      });
      md += `\n`;
    }
    if (synthesis.keyTakeaway) {
      md += `> **Regla de Oro:** ${synthesis.keyTakeaway}\n\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mejor-respuesta-ia-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendFollowup = async () => {
    if (!followupText.trim() || followupLoading) return;

    const q = followupText.trim();
    setFollowupLoading(true);
    setFollowupText('');
    const filesToPass = [...followupFiles];
    setFollowupFiles([]);

    try {
      const answer = await onFollowupQuestion(q, filesToPass);
      setFollowupChat((prev) => [...prev, { q, a: answer }]);
    } catch (e) {
      console.error(e);
      setFollowupChat((prev) => [...prev, { q, a: '**No se pudo obtener la respuesta.** Revisá la conexión o la clave de API y probá de nuevo.' }]);
    } finally {
      setFollowupLoading(false);
    }
  };

  const completedResponses = Object.values(responses).filter((r) => r.status === 'completed');

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* View Switcher Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedView('master')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              selectedView === 'master'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>La Mejor Respuesta</span>
          </button>

          {completedResponses.map((r) => (
            <button
              key={r.engineId}
              onClick={() => setSelectedView(r.engineId)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                selectedView === r.engineId
                  ? 'bg-slate-800 text-white border border-slate-700 font-semibold'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {r.engineName}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs border border-slate-800 transition-colors"
            title="Nueva consulta"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Nueva Consulta</span>
          </button>
          <button
            onClick={handleDownloadMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs border border-slate-800 transition-colors"
            title="Descargar en Markdown"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </div>

      {/* Main View: La Mejor Respuesta */}
      {selectedView === 'master' && (
        <div className="space-y-6">
          {/* Answer Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl space-y-5">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                  Respuesta de Consenso Multi-IA
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
                  {synthesis.title}
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  {synthesis.verdictSummary}
                </p>
              </div>

              <button
                onClick={() => handleCopy(synthesis.finalMasterResponse)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-colors shrink-0 self-start"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado' : 'Copiar Respuesta'}</span>
              </button>
            </div>

            {/* Markdown Body */}
            <div className="text-slate-100 text-sm sm:text-base leading-relaxed">
              <MarkdownRenderer content={synthesis.finalMasterResponse} />
            </div>

            {/* Action Plan */}
            {synthesis.actionPlan?.length > 0 && (
              <div className="mt-5 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Plan de acción directo
                </span>
                <div className="space-y-2">
                  {synthesis.actionPlan.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                      <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Key Takeaway */}
            {synthesis.keyTakeaway && (
              <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-200 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block mb-0.5">Regla de oro:</span>
                  <span>{synthesis.keyTakeaway}</span>
                </div>
              </div>
            )}
          </div>

          {/* Collapsible Detail: Consensus, Divergences, Scores */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowAnalysisDetails(!showAnalysisDetails)}
              className="w-full p-4 flex items-center justify-between text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800/40 transition-colors"
            >
              <span>Ver análisis del Árbitro (Consensos, discrepancias y puntuaciones)</span>
              {showAnalysisDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAnalysisDetails && (
              <div className="p-5 border-t border-slate-800 space-y-5 text-xs">
                {/* Scores grid */}
                <div>
                  <span className="font-bold text-slate-300 block mb-2">Puntuaciones del Jurado:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {synthesis.scores.map((sc) => (
                      <div key={sc.engineId} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                        <span className="font-bold text-white block text-sm">{sc.overallScore}/100</span>
                        <span className="text-[11px] text-slate-400 block mt-0.5">{sc.engineName}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Consensus points */}
                {synthesis.consensusPoints?.length > 0 && (
                  <div>
                    <span className="font-bold text-slate-300 block mb-1.5">Puntos de consenso unánime:</span>
                    <ul className="list-disc list-inside space-y-1 text-slate-400">
                      {synthesis.consensusPoints.map((cp, i) => (
                        <li key={i}>{cp}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Divergences */}
                {synthesis.divergences?.length > 0 && (
                  <div>
                    <span className="font-bold text-slate-300 block mb-1.5">Divergencias detectadas & Resolución:</span>
                    <div className="space-y-2">
                      {synthesis.divergences.map((d, i) => (
                        <div key={i} className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                          <span className="font-semibold text-white block">{d.topic}</span>
                          <p className="text-slate-400 mt-0.5">{d.disagreement}</p>
                          <p className="text-indigo-300 font-medium mt-1">Resolución óptima: {d.resolution}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Individual Engine View */}
      {selectedView !== 'master' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          {(() => {
            const currentResp = responses[selectedView];
            if (!currentResp) return <p className="text-slate-400 text-xs">No hay respuesta registrada.</p>;
            return (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-white">{currentResp.engineName}</h3>
                    <span className="text-xs text-slate-400">
                      Respuesta original sin editar • Latencia: {(currentResp.latencyMs / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(currentResp.response)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Copiar</span>
                  </button>
                </div>
                <div className="text-slate-200 text-sm leading-relaxed">
                  <MarkdownRenderer content={currentResp.response} />
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Interactive Debate & Follow-up Box */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-400" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Hacer una repregunta o solicitud de seguimiento
          </h4>
        </div>

        {/* Chat History */}
        {followupChat.length > 0 && (
          <div className="space-y-3 pt-1">
            {followupChat.map((msg, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-end">
                  <div className="bg-indigo-600/30 border border-indigo-500/30 rounded-2xl rounded-tr-none p-3 text-xs text-indigo-100 max-w-xl">
                    <span className="text-[10px] text-indigo-300 block mb-0.5">Tú</span>
                    {msg.q}
                  </div>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-2xl rounded-tl-none p-4 text-xs text-slate-200 space-y-1">
                  <span className="text-[10px] text-indigo-400 font-bold block mb-1">
                    Árbitro de Consenso
                  </span>
                  <MarkdownRenderer content={msg.a} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* File attachment for debate */}
        <FileAttachmentZone
          files={followupFiles}
          onAddFiles={(newF) => setFollowupFiles((p) => [...p, ...newF])}
          onRemoveFile={(id) => setFollowupFiles((p) => p.filter((f) => f.id !== id))}
          disabled={followupLoading}
        />

        {/* Input box */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={followupText}
            onChange={(e) => setFollowupText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendFollowup()}
            placeholder="Preguntale algo más a la IA sobre esta solución..."
            disabled={followupLoading}
            className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleSendFollowup}
            disabled={!followupText.trim() || followupLoading}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            {followupLoading ? (
              <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <span>Enviar</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
