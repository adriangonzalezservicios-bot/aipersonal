import React, { useEffect, useMemo, useState } from 'react';
import { Check, Download, ExternalLink, Share, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export const InstallPwaButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  const ios = useMemo(isIosDevice, []);

  useEffect(() => {
    setInstalled(isStandalone());

    const onBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setIosHelpOpen(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (installed) return null;

  const canNativeInstall = Boolean(deferredPrompt);
  const showButton = canNativeInstall || ios;
  if (!showButton) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => undefined);
      setDeferredPrompt(null);
      return;
    }
    setIosHelpOpen((open) => !open);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleInstall}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold transition-colors"
        title={canNativeInstall ? 'Instalar OmniSynth como app' : 'Cómo instalar OmniSynth'}
        aria-expanded={iosHelpOpen}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Instalar app</span>
        <span className="sm:hidden">Instalar</span>
      </button>

      {iosHelpOpen && ios && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[300px] rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl shadow-black/40">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <div className="text-sm font-bold text-white">Instalar en iPhone/iPad</div>
              <div className="text-xs text-slate-400 mt-1">Safari no muestra el aviso automático de instalación.</div>
            </div>
            <button
              type="button"
              onClick={() => setIosHelpOpen(false)}
              className="text-slate-500 hover:text-white"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex items-start gap-2"><Share className="w-4 h-4 mt-0.5 shrink-0 text-indigo-400" /><span>1. Tocá <b>Compartir</b> en Safari.</span></div>
            <div className="flex items-start gap-2"><ExternalLink className="w-4 h-4 mt-0.5 shrink-0 text-indigo-400" /><span>2. Elegí <b>Agregar a pantalla de inicio</b>.</span></div>
            <div className="flex items-start gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" /><span>3. Abrí OmniSynth desde el nuevo icono.</span></div>
          </div>
        </div>
      )}
    </div>
  );
};
