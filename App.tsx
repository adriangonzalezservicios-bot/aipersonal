/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Header, AppMode } from './components/Header';
import { PromptConsole } from './components/PromptConsole';
import { ParallelProgress } from './components/ParallelProgress';
import { CleanConsensusResults } from './components/CleanConsensusResults';
import { ImageStudio } from './components/ImageStudio';
import { VideoStudio } from './components/VideoStudio';
import { CustomEngineModal } from './components/CustomEngineModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { CriteriaModal } from './components/CriteriaModal';
import { ProfileModal } from './components/ProfileModal';
import { DEFAULT_AI_ENGINES, ADRIAN_PROFILE } from './data/defaultEngines';
import { 
  AiEngineConfig, 
  AiResponseResult, 
  MasterSynthesis, 
  ArbiterCriteria, 
  ConsensusSession,
  UserProfile,
  AttachedFile
} from './types/consensus';
import { AlertTriangle } from 'lucide-react';
import { BrainIndicator } from './components/BrainIndicator';
import { ensureBrainSession, getBrainAccessToken, isCloudBrainConfigured, supabase } from './lib/supabase';

const STORAGE_KEYS = {
  ENGINES: 'consensus_ai_engines_v3',
  SESSIONS: 'consensus_ai_sessions_v2',
  CRITERIA: 'consensus_ai_criteria_v2',
  PROFILE: 'consensus_ai_profile_v2',
};

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function readApiError(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => ({}));
  return typeof data?.error === 'string' && data.error.trim() ? data.error : fallback;
}

function normalizeStoredEngines(saved: AiEngineConfig[] | null): AiEngineConfig[] {
  if (!Array.isArray(saved)) return DEFAULT_AI_ENGINES;
  const migrations: Record<string, Partial<AiEngineConfig> & { promptReplace?: [string, string] }> = {
    deepseek_r1: {
      name: 'Gemini 3.7 Flash',
      provider: 'gemini',
      model: 'gemini-3.7-flash',
      providerLabel: 'Gemini real · Razonamiento Crítico & Lógica Pura',
      promptReplace: ['DeepSeek R1', 'Gemini 3.7 Flash'],
    },
    gpt_4o: {
      name: 'Gemini 3.6 Flash',
      provider: 'gemini',
      model: 'gemini-3.6-flash',
      providerLabel: 'Gemini real · Pragmatismo & Construcción Rápida',
      promptReplace: ['GPT-4o', 'Gemini 3.6 Flash'],
    },
    perplexity_research: {
      name: 'Gemini 3.5 Flash',
      provider: 'gemini',
      model: 'gemini-3.5-flash',
      providerLabel: 'Gemini real · Evidencia & Verificación',
      promptReplace: ['Perplexity Pro Research', 'Gemini 3.5 Flash'],
    },
  };

  const migrated = saved.map((engine) => {
    const patch = migrations[engine.id];
    if (!patch) return engine;
    let systemPrompt = engine.systemPrompt;
    if (patch.promptReplace) systemPrompt = systemPrompt.replaceAll(patch.promptReplace[0], patch.promptReplace[1]);
    const { promptReplace: _ignored, ...rest } = patch;
    return { ...engine, ...rest, systemPrompt };
  });

  // Add any new built-in engine that didn't exist in the persisted list.
  const ids = new Set(migrated.map((e) => e.id));
  return [...migrated, ...DEFAULT_AI_ENGINES.filter((e) => !ids.has(e.id))];
}

export default function App() {
  // User Profile (Adrián González)
  const [userProfile, setUserProfile] = useState<UserProfile>(() =>
    safeParse<UserProfile>(localStorage.getItem(STORAGE_KEYS.PROFILE), ADRIAN_PROFILE)
  );

  // Engine list
  const [engines, setEngines] = useState<AiEngineConfig[]>(() =>
    normalizeStoredEngines(safeParse<AiEngineConfig[] | null>(localStorage.getItem(STORAGE_KEYS.ENGINES), null))
  );

  // Mode switcher: search | image | video
  const [activeMode, setActiveMode] = useState<AppMode>('search');

  // Query & Context
  const [prompt, setPrompt] = useState<string>('');
  const [context, setContext] = useState<string>('');
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [criteria, setCriteria] = useState<ArbiterCriteria>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CRITERIA);
    const allowed: ArbiterCriteria[] = ['balanced', 'technical_rigor', 'practical_speed', 'creative_strategy', 'executive_brief'];
    return saved && allowed.includes(saved as ArbiterCriteria) ? (saved as ArbiterCriteria) : 'balanced';
  });

  // Orchestration & Results
  const [stage, setStage] = useState<'idle' | 'generating_responses' | 'synthesizing' | 'completed' | 'error'>('idle');
  const [responses, setResponses] = useState<Record<string, AiResponseResult>>({});
  const [synthesis, setSynthesis] = useState<MasterSynthesis | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const consensusAbortRef = useRef<AbortController | null>(null);

  // Persistent Brain status
  const [brainConnected, setBrainConnected] = useState(false);
  const [brainMemoryCount, setBrainMemoryCount] = useState(0);

  // History & Storage
  const [sessions, setSessions] = useState<ConsensusSession[]>(() =>
    safeParse<ConsensusSession[]>(localStorage.getItem(STORAGE_KEYS.SESSIONS), [])
  );

  // Manifest shortcuts can open OmniSynth directly in a specific workspace.
  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get('mode');
    if (mode === 'search' || mode === 'image' || mode === 'video') {
      setActiveMode(mode);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const initializeBrain = async () => {
      if (!isCloudBrainConfigured) {
        setBrainConnected(false);
        return;
      }
      try {
        await ensureBrainSession();
        const token = await getBrainAccessToken();
        const response = await fetch('/api/brain/status', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) throw new Error('No se pudo consultar el estado del cerebro.');
        const data = await response.json();
        if (!cancelled) {
          setBrainConnected(Boolean(data.connected));
          setBrainMemoryCount(Number(data.memoryCount || 0));
        }
      } catch (error) {
        console.warn('[Brain] inicialización omitida:', error);
        if (!cancelled) setBrainConnected(false);
      }
    };
    initializeBrain();

    const listener = supabase?.auth.onAuthStateChange(() => {
      void initializeBrain();
    });
    return () => {
      cancelled = true;
      listener?.data.subscription.unsubscribe();
    };
  }, []);

  // Modals
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Sync profile to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(userProfile));
    } catch (e) {
      console.error(e);
    }
  }, [userProfile]);

  // Sync engines to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ENGINES, JSON.stringify(engines));
    } catch (e) {
      console.error(e);
    }
  }, [engines]);

  // Sync criteria to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CRITERIA, criteria);
    } catch (e) {
      console.error(e);
    }
  }, [criteria]);

  // Sync sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.error(e);
    }
  }, [sessions]);

  // Profile handlers
  const handleToggleProfileActive = () => {
    setUserProfile((prev) => ({ ...prev, isActive: !prev.isActive }));
  };

  const handleUpdateDirectives = (directives: string) => {
    setUserProfile((prev) => ({ ...prev, systemDirectives: directives }));
  };

  // File handlers
  const handleAddFiles = (newFiles: AttachedFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Engine handlers
  const handleToggleEngine = (id: string) => {
    setEngines((prev) =>
      prev.map((e) => (e.id === id ? { ...e, enabled: !e.enabled } : e))
    );
  };

  const handleUpdateTemperature = (id: string, temp: number) => {
    setEngines((prev) =>
      prev.map((e) => (e.id === id ? { ...e, temperature: temp } : e))
    );
  };

  const handleDeleteCustomEngine = (id: string) => {
    setEngines((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSaveCustomEngine = (newEngine: AiEngineConfig) => {
    setEngines((prev) => [...prev, newEngine]);
  };

  // Main Consensus Execution
  const handleRunConsensus = async () => {
    if (!prompt.trim() || consensusAbortRef.current) return;

    const enabledEngines = engines.filter((e) => e.enabled);
    if (enabledEngines.length === 0) {
      setErrorMessage('Debes activar al menos una IA en el Jurado.');
      return;
    }

    setErrorMessage(null);
    setSynthesis(null);
    setStage('generating_responses');
    const controller = new AbortController();
    consensusAbortRef.current = controller;

    // Initialize pending responses map
    const initialMap: Record<string, AiResponseResult> = {};
    enabledEngines.forEach((e) => {
      initialMap[e.id] = {
        engineId: e.id,
        engineName: e.name,
        response: '',
        latencyMs: 0,
        status: 'generating',
        startedAt: Date.now(),
      };
    });
    setResponses(initialMap);

    try {
      // Step 1: Query all AIs in parallel through backend
      const brainToken = await getBrainAccessToken();
      const parallelRes = await fetch('/api/orchestrate-parallel?stream=1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(brainToken ? { Authorization: `Bearer ${brainToken}` } : {}),
        },
        body: JSON.stringify({
          prompt,
          context,
          engines: enabledEngines,
          userProfile,
          files,
        }),
        signal: controller.signal,
      });

      if (!parallelRes.ok || !parallelRes.body) {
        const errData = await parallelRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al orquestar los modelos en paralelo');
      }

      // Cada motor llega apenas termina (NDJSON); se actualiza su tarjeta sin esperar a los demás
      const updatedMap: Record<string, AiResponseResult> = { ...initialMap };
      const reader = parallelRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const handleLine = (line: string) => {
        if (!line.trim()) return;
        let evt: any;
        try {
          evt = JSON.parse(line);
        } catch {
          throw new Error('El servidor devolvió un evento inválido durante la consulta.');
        }
        if (evt.type === 'result') {
          const r: AiResponseResult = evt.result;
          updatedMap[r.engineId] = r;
          setResponses((prev) => ({ ...prev, [r.engineId]: r }));
        } else if (evt.type === 'fatal') {
          throw new Error(evt.error);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(handleLine);
      }
      buffer += decoder.decode();
      handleLine(buffer);
      const results = Object.values(updatedMap);

      // Step 2: Supreme Arbiter Synthesis
      setStage('synthesizing');

      const synthToken = await getBrainAccessToken();
      const synthRes = await fetch('/api/synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(synthToken ? { Authorization: `Bearer ${synthToken}` } : {}),
        },
        body: JSON.stringify({
          prompt,
          criteria,
          responses: results,
          userProfile,
          files,
        }),
        signal: controller.signal,
      });

      if (!synthRes.ok) {
        throw new Error(await readApiError(synthRes, 'Error durante la síntesis del Árbitro'));
      }

      const synthPayload = await synthRes.json();
      const synthData = synthPayload.synthesis;
      setSynthesis(synthData);
      if (synthPayload.brain) {
        setBrainConnected(Boolean(synthPayload.brain.connected));
        if (Number.isFinite(synthPayload.brain.remembered)) {
          setBrainMemoryCount((count) => count + Number(synthPayload.brain.remembered || 0));
        }
      }
      setStage('completed');

      // Save into session history
      const newSession: ConsensusSession = {
        id: `sess_${Date.now()}`,
        title: synthData.title || prompt.slice(0, 50),
        prompt,
        criteria,
        timestamp: new Date().toISOString(),
        enginesUsed: enabledEngines.map((e) => e.name),
        responses: updatedMap,
        synthesis: synthData,
        status: 'completed',
      };
      setSessions((prev) => [newSession, ...prev.slice(0, 24)]);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setErrorMessage('Consulta cancelada.');
        setStage('idle');
      } else {
        console.error(err);
        setErrorMessage(err?.message || 'Error inesperado en el proceso de consenso');
        setStage('error');
      }
    } finally {
      if (consensusAbortRef.current === controller) consensusAbortRef.current = null;
    }
  };

  // Follow-up debate handler
  const handleFollowupQuestion = async (
    question: string,
    followupFiles?: AttachedFile[]
  ): Promise<string> => {
    const combinedFiles = [...(followupFiles || []), ...(files || [])];
    const token = await getBrainAccessToken();
    const res = await fetch('/api/debate-followup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        question,
        masterSynthesis: synthesis,
        responses: Object.values(responses),
        previousPrompt: prompt,
        userProfile,
        files: combinedFiles,
      }),
    });

    if (!res.ok) {
      throw new Error(await readApiError(res, 'Fallo al consultar al Árbitro'));
    }

    const data = await res.json();
    return data.answer || 'Sin respuesta generada.';
  };

  const handleCancelConsensus = () => {
    consensusAbortRef.current?.abort();
  };

  // Reset to new clean query
  const handleResetSession = () => {
    consensusAbortRef.current?.abort();
    consensusAbortRef.current = null;
    setPrompt('');
    setContext('');
    setFiles([]);
    setResponses({});
    setSynthesis(null);
    setStage('idle');
    setErrorMessage(null);
  };

  // Load a session from history
  const handleSelectSession = (sess: ConsensusSession) => {
    setPrompt(sess.prompt);
    setCriteria(sess.criteria);
    setResponses(sess.responses || {});
    setSynthesis(sess.synthesis);
    setStage('completed');
    setErrorMessage(null);
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClearAllSessions = () => {
    setSessions([]);
  };

  const activeCount = engines.filter((e) => e.enabled).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header Navigation */}
      <Header
        activeTab={activeMode}
        onSelectTab={setActiveMode}
        activeEngineCount={activeCount}
        criteria={criteria}
        onOpenCriteriaModal={() => setIsCriteriaModalOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={sessions.length}
        brainConfigured={isCloudBrainConfigured}
        brainConnected={brainConnected}
        brainMemoryCount={brainMemoryCount}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onResetSession={handleResetSession}
        isProcessing={stage === 'generating_responses' || stage === 'synthesizing'}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Error message banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 flex items-center justify-between text-xs sm:text-sm text-red-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-red-400 hover:text-white font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab 1: Search & Multi-AI Consensus */}
        {activeMode === 'search' && (
          <div className="space-y-6">
            {!synthesis && (
              <>
                <div className="text-center max-w-2xl mx-auto pt-2 pb-1 space-y-1">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    Consulta a Múltiples IAs en Simultáneo
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400">
                    Preguntá lo que necesites o adjuntá archivos. Varios especialistas (perspectivas con roles distintos, sobre Gemini) responden en paralelo y un árbitro sintetiza la mejor respuesta.
                  </p>
                </div>

                <PromptConsole
                  prompt={prompt}
                  onPromptChange={setPrompt}
                  files={files}
                  onAddFiles={handleAddFiles}
                  onRemoveFile={handleRemoveFile}
                  criteria={criteria}
                  onCriteriaChange={setCriteria}
                  engines={engines}
                  onToggleEngine={handleToggleEngine}
                  onSubmit={handleRunConsensus}
                  isProcessing={stage === 'generating_responses' || stage === 'synthesizing'}
                />

                <ParallelProgress
                  engines={engines}
                  responses={responses}
                  stage={stage}
                />
              </>
            )}

            {synthesis && (
              <CleanConsensusResults
                synthesis={synthesis}
                responses={responses}
                engines={engines}
                originalPrompt={prompt}
                onFollowupQuestion={handleFollowupQuestion}
                onReset={handleResetSession}
              />
            )}
          </div>
        )}

        {/* Tab 2: Create Images */}
        {activeMode === 'image' && (
          <ImageStudio userProfile={userProfile} />
        )}

        {/* Tab 3: Create Videos */}
        {activeMode === 'video' && (
          <VideoStudio userProfile={userProfile} />
        )}
      </main>

      {/* Modals & Drawers */}
      <CustomEngineModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        onSaveEngine={handleSaveCustomEngine}
      />

      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        sessions={sessions}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onClearAll={handleClearAllSessions}
      />

      <CriteriaModal
        isOpen={isCriteriaModalOpen}
        onClose={() => setIsCriteriaModalOpen(false)}
        selectedCriteria={criteria}
        onSelectCriteria={setCriteria}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profile={userProfile}
        onToggleActive={handleToggleProfileActive}
        onUpdateDirectives={handleUpdateDirectives}
      />
    </div>
  );
}
