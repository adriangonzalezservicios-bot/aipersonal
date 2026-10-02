export interface AiEngineConfig {
  id: string;
  name: string;
  providerLabel: string;
  badge: string;
  description: string;
  color: string; // Tailwind color class or hex
  accentColor: string;
  iconName: 'brain' | 'sparkles' | 'cpu' | 'book-open' | 'zap' | 'shield-check' | 'sliders';
  systemPrompt: string;
  temperature: number;
  enabled: boolean;
  isCustom?: boolean;
  provider?: 'gemini' | 'claude'; // por defecto gemini
  model?: string; // modelo concreto del proveedor
}

export interface AiResponseResult {
  engineId: string;
  engineName: string;
  response: string;
  latencyMs: number;
  status: 'pending' | 'generating' | 'completed' | 'error';
  error?: string;
  tokensEstimated?: number;
  startedAt?: number; // epoch ms, solo cliente (progreso en vivo)
}

export interface EngineScore {
  engineId: string;
  engineName: string;
  accuracy: number; // 0 - 100
  depth: number; // 0 - 100
  practicality: number; // 0 - 100
  clarity: number; // 0 - 100
  overallScore: number; // 0 - 100
  strengths: string[];
  weaknesses: string[];
}

export interface DivergenceItem {
  topic: string;
  disagreement: string;
  resolution: string;
}

export interface MasterSynthesis {
  title: string;
  verdictSummary: string;
  bestOverallAiId: string;
  bestOverallAiName: string;
  scores: EngineScore[];
  consensusPoints: string[];
  divergences: DivergenceItem[];
  blindspotsOrErrors: string[];
  finalMasterResponse: string;
  actionPlan: string[];
  keyTakeaway: string;
  evaluatedAt: string;
}

export type ArbiterCriteria = 
  | 'balanced' 
  | 'technical_rigor' 
  | 'practical_speed' 
  | 'creative_strategy' 
  | 'executive_brief';

export interface ConsensusSession {
  id: string;
  title: string;
  prompt: string;
  criteria: ArbiterCriteria;
  timestamp: string;
  enginesUsed: string[];
  responses: Record<string, AiResponseResult>;
  synthesis: MasterSynthesis | null;
  status: 'idle' | 'generating_responses' | 'synthesizing' | 'completed' | 'error';
  error?: string;
}

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string; // text content or base64 data
  isImage?: boolean;
  previewUrl?: string;
}

export interface UserProfile {
  name: string;
  isActive: boolean;
  role: string;
  style: string;
  businesses: string[];
  bookProject: string;
  systemDirectives: string;
}

export interface ExternalApiKeys {
  openaiKey?: string;
  anthropicKey?: string;
  openrouterKey?: string;
  groqKey?: string;
}
