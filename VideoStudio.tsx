import React, { useState } from 'react';
import { 
  Video, 
  Sparkles, 
  Copy, 
  Check, 
  Film, 
  Play, 
  Pause, 
  ChevronRight, 
  ChevronLeft, 
  Volume2, 
  Camera, 
  SlidersHorizontal 
} from 'lucide-react';
import { UserProfile } from '../types/consensus';

interface StoryboardScene {
  sceneNumber: number;
  durationSec: number;
  shotType: string;
  cameraMotion: string;
  visualDescription: string;
  soundDesign: string;
  voiceover: string;
  previewImageUrl?: string;
}

interface VideoStoryboard {
  title: string;
  concept: string;
  masterPrompt: string;
  scenes: StoryboardScene[];
}

interface VideoStudioProps {
  userProfile?: UserProfile;
}

const DURATIONS = [
  { id: '15s', label: '15s (Reels / TikTok / Shorts)' },
  { id: '30s', label: '30s (Spot Comercial)' },
  { id: '60s', label: '60s (Narrativo / Explicativo)' },
];

const STYLES = [
  { id: 'cinematic', label: 'Cinemático' },
  { id: 'commercial', label: 'Comercial de Producto' },
  { id: 'documentary', label: 'Documental Directo' },
  { id: 'minimalist_tech', label: 'Tecnológico & Minimalista' },
];

export const VideoStudio: React.FC<VideoStudioProps> = ({ userProfile }) => {
  const [prompt, setPrompt] = useState('');
  const [duration, setDuration] = useState('15s');
  const [style, setStyle] = useState('cinematic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [storyboard, setStoryboard] = useState<VideoStoryboard | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [copiedMaster, setCopiedMaster] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/generate-video-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          duration,
          style,
          userProfile,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Error al generar el guión de video');
      }

      const data = await res.json();
      setStoryboard(data.storyboard);
      setActiveSceneIndex(0);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'No se pudo generar el guión de video.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyMasterPrompt = () => {
    if (!storyboard?.masterPrompt) return;
    navigator.clipboard.writeText(storyboard.masterPrompt);
    setCopiedMaster(true);
    setTimeout(() => setCopiedMaster(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-200">
          {errorMessage}
        </div>
      )}

      {/* Creation Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-indigo-400" />
            <span>Generador de Video & Storyboard con IA</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Diseñá videos comerciales, trailers o escenas. La IA desglosa la toma, movimientos de cámara, guión y prompts listos para Sora o Runway.
          </p>
        </div>

        {/* Prompt Input */}
        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && handleGenerate()}
            placeholder="Describí la idea del video: por ejemplo, 'Spot publicitario de 15 segundos para liquidación relámpago de electrodomésticos, ritmo dinámico y tomas macro de los productos'..."
            rows={3}
            disabled={isGenerating}
            className="w-full rounded-xl bg-slate-950 border border-slate-700/80 p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-y"
          />
        </div>

        {/* Options Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Duration */}
          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1.5">Duración estimada:</span>
            <div className="flex flex-col gap-1.5">
              {DURATIONS.map((dur) => (
                <button
                  key={dur.id}
                  type="button"
                  onClick={() => setDuration(dur.id)}
                  disabled={isGenerating}
                  className={`p-2 rounded-lg border text-left text-xs transition-all ${
                    duration === dur.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {dur.label}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1.5">Estilo visual & tono:</span>
            <div className="flex flex-col gap-1.5">
              {STYLES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStyle(st.id)}
                  disabled={isGenerating}
                  className={`p-2 rounded-lg border text-left text-xs transition-all ${
                    style === st.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end pt-2">
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
              !prompt.trim() || isGenerating
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20 hover:scale-[1.01] active:scale-[0.99]'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>Generando storyboard cinematográfico...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Crear Guión & Video</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Storyboard Result Display */}
      {storyboard && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6 animate-in fade-in duration-300">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <span className="text-xs uppercase tracking-wider text-indigo-400 font-bold">Proyecto Audiovisual</span>
              <h3 className="text-lg font-bold text-white mt-0.5">{storyboard.title}</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">{storyboard.concept}</p>
            </div>
            <button
              onClick={handleCopyMasterPrompt}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition-colors shrink-0"
              title="Copiar prompt maestro para Sora / Runway"
            >
              {copiedMaster ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedMaster ? 'Prompt copiado' : 'Copiar Prompt para Sora / Runway'}</span>
            </button>
          </div>

          {/* Interactive Scene Showcase */}
          {storyboard.scenes?.length > 0 && (
            <div className="space-y-4">
              {/* Scene Stepper Bar */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">
                  Escena {activeSceneIndex + 1} de {storyboard.scenes.length} ({storyboard.scenes[activeSceneIndex]?.durationSec}s)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveSceneIndex((prev) => Math.max(0, prev - 1))}
                    disabled={activeSceneIndex === 0}
                    className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveSceneIndex((prev) => Math.min(storyboard.scenes.length - 1, prev + 1))}
                    disabled={activeSceneIndex === storyboard.scenes.length - 1}
                    className="p-1.5 rounded-lg bg-slate-800 disabled:opacity-40 text-slate-300 hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Active Scene Card */}
              {storyboard.scenes[activeSceneIndex] && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl bg-slate-950 border border-slate-800 p-4">
                  {/* Visual Preview */}
                  <div className="rounded-lg overflow-hidden bg-slate-900 border border-slate-800/80 flex items-center justify-center min-h-[220px]">
                    {storyboard.scenes[activeSceneIndex].previewImageUrl ? (
                      <img
                        src={storyboard.scenes[activeSceneIndex].previewImageUrl}
                        alt={`Escena ${activeSceneIndex + 1}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover max-h-[260px]"
                      />
                    ) : (
                      <Film className="w-10 h-10 text-slate-600" />
                    )}
                  </div>

                  {/* Scene Specs */}
                  <div className="space-y-3 flex flex-col justify-between text-xs">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                          {storyboard.scenes[activeSceneIndex].shotType}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {storyboard.scenes[activeSceneIndex].cameraMotion}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Acción visual</span>
                        <p className="text-slate-200 mt-0.5 leading-relaxed">
                          {storyboard.scenes[activeSceneIndex].visualDescription}
                        </p>
                      </div>

                      {storyboard.scenes[activeSceneIndex].voiceover && (
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">Voz en off</span>
                          <p className="text-slate-300 italic mt-0.5">
                            "{storyboard.scenes[activeSceneIndex].voiceover}"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2 text-slate-400 text-[11px]">
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{storyboard.scenes[activeSceneIndex].soundDesign}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* All scenes thumbnails strip */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
                {storyboard.scenes.map((sc, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveSceneIndex(i)}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      activeSceneIndex === i
                        ? 'bg-slate-800 border-indigo-500 text-white ring-1 ring-indigo-500/30'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <span className="block font-bold text-[11px] text-indigo-300">Escena {sc.sceneNumber}</span>
                    <span className="block text-[10px] text-slate-400 truncate mt-0.5">{sc.shotType}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
