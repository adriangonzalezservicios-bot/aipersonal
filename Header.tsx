import React from 'react';
import { 
  Sparkles, 
  Search, 
  Image as ImageIcon, 
  Video, 
  History, 
  Settings, 
  RotateCcw,
  SlidersHorizontal 
} from 'lucide-react';
import { ArbiterCriteria } from '../types/consensus';
import { BrainIndicator } from './BrainIndicator';
import { InstallPwaButton } from './InstallPwaButton';

export type AppMode = 'search' | 'image' | 'video';

interface HeaderProps {
  activeTab: AppMode;
  onSelectTab: (tab: AppMode) => void;
  activeEngineCount: number;
  criteria: ArbiterCriteria;
  onOpenCriteriaModal: () => void;
  onOpenHistory: () => void;
  historyCount: number;
  brainConfigured: boolean;
  brainConnected: boolean;
  brainMemoryCount: number;
  onOpenProfileModal: () => void;
  onResetSession: () => void;
  isProcessing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  activeEngineCount,
  criteria,
  onOpenCriteriaModal,
  onOpenHistory,
  historyCount,
  brainConfigured,
  brainConnected,
  brainMemoryCount,
  onOpenProfileModal,
  onResetSession,
  isProcessing,
}) => {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/90 border-b border-slate-800 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                Omni<span className="text-indigo-400">AI</span>
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 hidden sm:inline">
                Multi-Modelo
              </span>
            </div>
          </div>
        </div>

        {/* Central Mode Selector */}
        <nav className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <button
            onClick={() => onSelectTab('search')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'search'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Búsqueda & Respuestas</span>
            <span className="sm:hidden">Consultas</span>
          </button>

          <button
            onClick={() => onSelectTab('image')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'image'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Imágenes</span>
          </button>

          <button
            onClick={() => onSelectTab('video')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'video'
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Videos</span>
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <BrainIndicator
            configured={brainConfigured}
            connected={brainConnected}
            memoryCount={brainMemoryCount}
          />
          <InstallPwaButton />
          {/* History */}
          <button
            onClick={onOpenHistory}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs transition-colors"
            title="Historial de consultas"
          >
            <History className="w-3.5 h-3.5" />
            {historyCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-slate-800 text-indigo-400 font-bold text-[10px] flex items-center justify-center">
                {historyCount}
              </span>
            )}
          </button>

          {/* Settings / Training Profile */}
          <button
            onClick={onOpenProfileModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs transition-colors"
            title="Entrenamiento & Configuración de IA"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Entrenamiento</span>
          </button>
        </div>
      </div>
    </header>
  );
};
