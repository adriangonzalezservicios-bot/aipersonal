import React, { useState } from 'react';
import { 
  Sparkles, 
  Download, 
  Copy, 
  Check, 
  Maximize2, 
  RefreshCw, 
  Layers, 
  Sliders, 
  Image as ImageIcon 
} from 'lucide-react';
import { UserProfile } from '../types/consensus';

interface GeneratedImageItem {
  id: string;
  imageUrl: string;
  originalPrompt: string;
  enhancedPrompt: string;
  aspectRatio: string;
  style: string;
  createdAt: string;
}

interface ImageStudioProps {
  userProfile?: UserProfile;
}

const STYLES = [
  { id: 'photorealistic', label: 'Fotorrealista' },
  { id: 'cinematic', label: 'Cinemático' },
  { id: '3d_render', label: '3D Render' },
  { id: 'minimalist', label: 'Minimalista' },
  { id: 'digital_art', label: 'Arte Digital' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 Cuadrado', desc: 'Ideal redes / perfil' },
  { id: '16:9', label: '16:9 Panorámico', desc: 'Web / YouTube / Banners' },
  { id: '9:16', label: '9:16 Vertical', desc: 'Stories / TikTok / Reels' },
  { id: '4:3', label: '4:3 Estándar', desc: 'Catálogos / eCommerce' },
];

export const ImageStudio: React.FC<ImageStudioProps> = ({ userProfile }) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('photorealistic');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentImage, setCurrentImage] = useState<GeneratedImageItem | null>(null);
  const [gallery, setGallery] = useState<GeneratedImageItem[]>([]);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [showEnhanced, setShowEnhanced] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style,
          aspectRatio,
          userProfile,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Error al generar la imagen');
      }

      const data = await res.json();
      const newItem: GeneratedImageItem = {
        id: `img_${Date.now()}`,
        imageUrl: data.imageUrl,
        originalPrompt: data.originalPrompt,
        enhancedPrompt: data.enhancedPrompt,
        aspectRatio: data.aspectRatio,
        style: data.style,
        createdAt: data.createdAt,
      };

      setCurrentImage(newItem);
      setGallery((prev) => [newItem, ...prev.slice(0, 11)]);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'No se pudo generar la imagen.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async (img: GeneratedImageItem) => {
    try {
      const res = await fetch(img.imageUrl);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `imagen-ia-${Date.now()}.jpg`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      window.open(img.imageUrl, '_blank');
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setErrorMessage('El navegador no permitió copiar el enlace automáticamente.');
      return;
    }
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Creation Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-indigo-400" />
            <span>Generador de Imágenes con IA</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Describí la imagen que necesitás. La IA refina los detalles visuales y genera una composición en alta resolución.
          </p>
        </div>

        {/* Prompt Input */}
        <div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && handleGenerate()}
            placeholder="Describí la imagen con tus palabras: por ejemplo, 'Fotografía de estudio minimalista de un electrodoméstico moderno en acero pulido sobre fondo oscuro, iluminación cenital'..."
            rows={3}
            disabled={isGenerating}
            className="w-full rounded-xl bg-slate-950 border border-slate-700/80 p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-y"
          />
        </div>

        {/* Options Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Aspect Ratio */}
          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1.5">Formato / Proporción:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {ASPECT_RATIOS.map((ar) => (
                <button
                  key={ar.id}
                  type="button"
                  onClick={() => setAspectRatio(ar.id)}
                  disabled={isGenerating}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    aspectRatio === ar.id
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <span className="block text-xs">{ar.label}</span>
                  <span className="block text-[10px] text-slate-500 truncate">{ar.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <span className="block text-xs font-medium text-slate-400 mb-1.5">Estilo visual:</span>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStyle(st.id)}
                  disabled={isGenerating}
                  className={`px-3 py-2 rounded-lg border text-xs transition-all ${
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
                <span>Generando imagen en HD...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generar Imagen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-200">
          {errorMessage}
        </div>
      )}

      {/* Main Image Display */}
      {currentImage && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <span className="text-xs text-slate-400">Resultado:</span>
              <p className="text-sm font-semibold text-white line-clamp-1">{currentImage.originalPrompt}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyUrl(currentImage.imageUrl)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
                title="Copiar enlace"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl ? 'Copiado' : 'Copiar enlace'}</span>
              </button>
              <button
                onClick={() => handleDownload(currentImage)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-semibold transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar</span>
              </button>
            </div>
          </div>

          {/* Image Container */}
          <div className="relative rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800/80">
            <img
              src={currentImage.imageUrl}
              alt={currentImage.originalPrompt}
              referrerPolicy="no-referrer"
              className="max-h-[600px] w-auto object-contain rounded-xl"
            />
          </div>

          {/* Prompt breakdown */}
          <div className="pt-2 text-xs text-slate-400">
            <button
              onClick={() => setShowEnhanced(!showEnhanced)}
              className="text-indigo-400 hover:underline font-medium"
            >
              {showEnhanced ? 'Ocultar prompt en inglés enriquecido por la IA' : 'Ver prompt en inglés enriquecido por la IA'}
            </button>
            {showEnhanced && (
              <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300">
                {currentImage.enhancedPrompt}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gallery of Session Images */}
      {gallery.length > 1 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Creaciones de esta sesión ({gallery.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {gallery.map((item) => (
              <div
                key={item.id}
                onClick={() => setCurrentImage(item)}
                className={`group cursor-pointer rounded-xl overflow-hidden border transition-all ${
                  currentImage?.id === item.id
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <img
                  src={item.imageUrl}
                  alt={item.originalPrompt}
                  referrerPolicy="no-referrer"
                  className="w-full h-28 object-cover group-hover:scale-105 transition-transform"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
