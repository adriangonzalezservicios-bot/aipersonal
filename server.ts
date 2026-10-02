import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { isBrainCloudConfigured, brainStats, formatBrainContext, recallBrain, rememberBrain, saveBrainSession, forgetBrain, type BrainMemoryCandidate } from './brain';

// Load .env first, then let .env.local override it for local development.
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local', override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const apiKey = process.env.GEMINI_API_KEY || '';
const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
const ARBITER: 'claude' | 'gemini' =
  (process.env.ARBITER_PROVIDER as any) === 'gemini' ? 'gemini' : anthropicKey ? 'claude' : 'gemini';
const ARBITER_MODEL = process.env.ARBITER_MODEL || 'claude-opus-5-5';
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';

app.set('trust proxy', 1);
app.use(express.json({ limit: '30mb', strict: true }));

// Initialize GoogleGenAI SDK as per guideline
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Modelos configurables por entorno (GEMINI_MODELS="a,b,c"), en orden de preferencia
const MODELS = (process.env.GEMINI_MODELS || 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-flash-latest')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const RETRYABLE = new Set([404, 429, 500, 502, 503, 504]);

// Guardas de /api: clave presente y límite de solicitudes por IP (protege el costo de la API key)
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MIN || '60', 10);
const hits = new Map<string, { count: number; reset: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [ip, h] of hits) if (now > h.reset) hits.delete(ip);
}, 60_000).unref();

app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (!apiKey && !anthropicKey) {
    return res.status(503).json({ error: 'Faltan claves: configurá GEMINI_API_KEY y/o ANTHROPIC_API_KEY en .env.local y reiniciá.' });
  }
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.reset) {
    hits.set(ip, { count: 1, reset: now + 60_000 });
    return next();
  }
  if (++h.count > RATE_LIMIT) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un minuto e intentá de nuevo.' });
  }
  next();
});

/**
 * Generación resiliente: respeta el modelo preferido del motor y luego prueba
 * los fallbacks configurados. Solo reintenta errores transitorios.
 */
async function generateContentWithFallback(params: any) {
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY en .env.local.');

  const preferredModel = typeof params?.model === 'string' ? params.model.trim() : '';
  const candidates = [...new Set([preferredModel, ...MODELS].filter(Boolean))];
  const request = { ...params };
  delete request.model;

  let lastError: any = null;
  for (const model of candidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({ ...request, model });
      } catch (err: any) {
        lastError = err;
        const status = Number(err?.status ?? err?.code);
        if (status && !RETRYABLE.has(status)) throw err;
        console.warn(`[GenAI] ${model} falló (${status || err?.message?.slice(0, 100)}), intento ${attempt + 1}/2`);
        if (status === 404) break;
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error('No se pudo generar contenido con Gemini.');
}

// ---------------- Claude (API de Anthropic, vía fetch, sin dependencias) ----------------
type Media = { mime: string; data: string };
const CLAUDE_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

/** Convierte el schema de @google/genai (tipos en MAYÚSCULA) a JSON Schema estándar */
function toJsonSchema(node: any): any {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (node && typeof node === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = k === 'type' && typeof v === 'string' ? v.toLowerCase() : toJsonSchema(v);
    }
    return out;
  }
  return node;
}

/** Anthropic requiere additionalProperties=false en objetos de structured outputs. */
function hardenJsonSchema(schema: any): any {
  const normalized = toJsonSchema(schema);
  if (Array.isArray(normalized)) return normalized.map(hardenJsonSchema);
  if (!normalized || typeof normalized !== 'object') return normalized;
  const out: any = { ...normalized };
  if (out.type === 'object') {
    out.additionalProperties = false;
    if (out.properties && typeof out.properties === 'object') {
      out.properties = Object.fromEntries(
        Object.entries(out.properties).map(([key, value]) => [key, hardenJsonSchema(value)])
      );
    }
  }
  if (out.items) out.items = hardenJsonSchema(out.items);
  if (Array.isArray(out.anyOf)) out.anyOf = out.anyOf.map(hardenJsonSchema);
  if (Array.isArray(out.allOf)) out.allOf = out.allOf.map(hardenJsonSchema);
  return out;
}

function isRetryableStatus(status: number): boolean {
  return [429, 500, 502, 503, 504, 529].includes(status);
}

async function generateImageWithFallback(params: { model: string; contents: any; config: any }) {
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY en .env.local.');
  const candidates = [...new Set([params.model, 'gemini-3.1-flash-image', 'gemini-3-pro-image'].filter(Boolean))];
  let lastError: any = null;
  for (const model of candidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({ ...params, model });
      } catch (err: any) {
        lastError = err;
        const status = Number(err?.status ?? err?.code);
        if (status === 404) break;
        if (status && ![429, 500, 502, 503, 504].includes(status)) throw err;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error('No se pudo generar la imagen con Gemini.');
}

async function callClaude(opts: {
  model: string;
  system?: string;
  text: string;
  media?: Media[];
  temperature?: number;
  maxTokens?: number;
  schema?: any;
}): Promise<any> {
  if (!anthropicKey) throw new Error('Falta ANTHROPIC_API_KEY en .env.local para usar Claude.');

  const content: any[] = [];
  for (const m of opts.media || []) {
    if (m.mime === 'application/pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: m.mime, data: m.data } });
    } else if (CLAUDE_IMAGE_MIMES.has(m.mime)) {
      content.push({ type: 'image', source: { type: 'base64', media_type: m.mime, data: m.data } });
    }
  }
  content.push({ type: 'text', text: opts.text });

  const body: any = {
    model: opts.model,
    max_tokens: opts.maxTokens || 8192,
    messages: [{ role: 'user', content }],
  };
  if (opts.system) body.system = opts.system;
  if (opts.schema) {
    body.output_config = {
      format: {
        type: 'json_schema',
        schema: hardenJsonSchema(opts.schema),
      },
    };
  }

  const candidates = [...new Set([opts.model, CLAUDE_DEFAULT_MODEL, 'claude-haiku-4-5-20251001'].filter(Boolean))];
  let lastErr: any = null;
  for (const model of candidates) {
    body.model = model;
    for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(240_000),
      });
      const data: any = await r.json().catch(() => ({}));
      if (!r.ok) {
        const err: any = new Error(data?.error?.message || `Claude respondió ${r.status}`);
        err.status = r.status;
        throw err;
      }
      if (opts.schema) {
        const text = (data.content || [])
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('')
          .trim();
        if (!text) throw new Error('Claude no devolvió el resultado estructurado.');
        return parseJsonPayload(text);
      }
      return (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    } catch (err: any) {
      lastErr = err;
      const status = Number(err?.status);
      if (status === 404) break;
      if (status && !isRetryableStatus(status)) throw err;
      console.warn(`[Claude] ${model} falló (${status || err?.message}), intento ${attempt + 1}/3`);
      await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  }
  throw lastErr || new Error('No se pudo generar contenido con Claude.');
}

/** Separa el texto y los adjuntos multimedia, comunes a Gemini y Claude */
function prepareInput(prompt: string, context?: string, files?: any[]): { text: string; media: Media[] } {
  let text = prompt;
  if (context && context.trim()) {
    text = `CONTEXTO PREVIO / DATOS ADICIONALES:\n${context.trim()}\n\nCONSULTA / SOLICITUD:\n${text}`;
  }
  const media: Media[] = [];
  let attachedTextDocs = '';
  const supportedTextMimes = new Set([
    'text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/xml',
    'text/xml', 'text/javascript', 'application/javascript', 'text/x-python', 'text/x-sql', ''
  ]);
  const MAX_TEXT_PER_FILE = 100_000;

  for (const file of Array.isArray(files) ? files : []) {
    if (!file?.content) continue;
    const mime = String(file.type || '').toLowerCase();
    const name = String(file.name || 'archivo').toLowerCase();
    const extension = name.includes('.') ? `.${name.split('.').pop()}` : '';
    const textLikeExtension = new Set(['.txt', '.md', '.csv', '.json', '.xml', '.ts', '.tsx', '.js', '.jsx', '.py', '.sql', '.html', '.css', '.yaml', '.yml']);
    const looksText = supportedTextMimes.has(mime) || textLikeExtension.has(extension);
    if (mime.startsWith('image/') || mime === 'application/pdf') {
      const data = file.content.includes('base64,') ? file.content.split('base64,')[1] : file.content;
      media.push({ mime, data });
    } else if (looksText) {
      const raw = String(file.content);
      const trimmed = raw.length > MAX_TEXT_PER_FILE
        ? `${raw.slice(0, MAX_TEXT_PER_FILE)}\n[Contenido truncado por seguridad/costo: ${raw.length - MAX_TEXT_PER_FILE} caracteres omitidos]`
        : raw;
      attachedTextDocs += `\n\n=== ARCHIVO ADJUNTO: ${file.name} ===\n${trimmed}\n=== FIN ARCHIVO ===`;
    } else {
      attachedTextDocs += `\n\n=== ARCHIVO NO PROCESADO: ${file.name} ===\nFormato binario no soportado por esta versión. Convertí el archivo a PDF, CSV, TXT, MD o JSON y volvé a adjuntarlo.\n=== FIN ARCHIVO ===`;
    }
  }
  if (attachedTextDocs) text = `${text}\n${attachedTextDocs}`;
  return { text, media };
}

/** Parseo robusto de JSON aunque el proveedor agregue fences o texto periférico. */
function parseJsonPayload(raw: string): any {
  const clean = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    let depth = 0;
    let inString = false;
    let escaped = false;
    let start = -1;
    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start >= 0) return JSON.parse(clean.slice(start, i + 1));
      }
    }
  }
  throw new Error('La IA no devolvió un JSON válido.');
}

/** Contenido para Gemini */
function buildContentsWithFiles(prompt: string, context?: string, files?: any[]) {
  const { text, media } = prepareInput(prompt, context, files);
  if (media.length === 0) return text;
  return [...media.map((m) => ({ inlineData: { mimeType: m.mime, data: m.data } })), { text }];
}

/** Reglas de artefactos: los bloques con estos lenguajes se renderizan como vista previa en la app */
const ARTIFACT_RULES = `ARTEFACTOS: si el pedido implica construir una página, app, componente, visualización, diagrama o pieza reutilizable, entregala completa en UN solo bloque de código con uno de estos lenguajes: html (autocontenido, CSS y JS inline, sin archivos externos), svg, jsx (componente React en JavaScript sin tipos, con "export default", solo imports de "react"; Tailwind CSS disponible), o mermaid. La explicación va fuera del bloque. No cortes el código ni uses "..." para abreviar.`;

// Criteria prompt directives for the Arbiter
const criteriaGuidelines: Record<string, string> = {
  balanced:
    'Criterio Equilibrado: Evalúa balanceando por igual rigor lógico, aplicabilidad práctica en el mundo real, profundidad y claridad expositiva.',
  technical_rigor:
    'Criterio de Rigor Técnico: Prioriza exactitud formal, solidez matemática/lógica, verificación de casos límite (edge cases) y ausencia total de fallas.',
  practical_speed:
    'Criterio de Practicidad & Velocidad: Prioriza soluciones inmediatamente aplicables, código listo para producción, pasos directos sin teoría innecesaria.',
  creative_strategy:
    'Criterio Estratégico & Creativo: Prioriza innovación disruptiva, visión sistémica a largo plazo, ventajas competitivas y originalidad constructiva.',
  executive_brief:
    'Criterio Ejecutivo: Prioriza máxima concisión, impacto en métricas clave (ROI/eficiencia/coste) y recomendaciones claras para toma de decisiones.',
};

/**
 * Endpoint to test server health and key presence
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
    arbiter: ARBITER,
    geminiModels: MODELS,
    defaults: { claude: CLAUDE_DEFAULT_MODEL, arbiter: ARBITER_MODEL },
    configuredProviders: { gemini: !!apiKey, anthropic: !!anthropicKey },
    time: new Date().toISOString(),
  });
});

/** Persistent Brain API. JWT is verified server-side before cloud access. */
app.get('/api/brain/status', async (req, res) => {
  try {
    return res.json(await brainStats(req));
  } catch (error: any) {
    console.error('Error in /api/brain/status:', error);
    return res.status(500).json({ configured: isBrainCloudConfigured(), connected: false, memoryCount: 0, error: error?.message || 'Error de memoria' });
  }
});

app.post('/api/brain/recall', async (req, res) => {
  try {
    const query = String(req.body?.query || req.body?.prompt || '').trim();
    if (!query) return res.status(400).json({ error: 'Falta la consulta de memoria' });
    return res.json(await recallBrain(req, query, Math.min(Number(req.body?.limit || 8), 20)));
  } catch (error: any) {
    console.error('Error in /api/brain/recall:', error);
    return res.status(500).json({ error: error?.message || 'Error al recuperar memoria' });
  }
});

app.post('/api/brain/remember', async (req, res) => {
  try {
    const memories = Array.isArray(req.body?.memories) ? req.body.memories as BrainMemoryCandidate[] : [];
    const ids = await rememberBrain(req, memories, { source: 'manual' });
    return res.json({ ids, saved: ids.length });
  } catch (error: any) {
    console.error('Error in /api/brain/remember:', error);
    return res.status(500).json({ error: error?.message || 'Error al guardar memoria' });
  }
});

app.delete('/api/brain/forget', async (req, res) => {
  try {
    const id = typeof req.body?.id === 'string' ? req.body.id : undefined;
    const deleted = await forgetBrain(req, id);
    return res.json({ deleted });
  } catch (error: any) {
    console.error('Error in /api/brain/forget:', error);
    return res.status(500).json({ error: error?.message || 'Error al borrar memoria' });
  }
});

/**
 * Generate response for a single AI engine configuration
 */
app.post('/api/generate-engine', async (req, res) => {
  try {
    const { prompt, engine, context, files } = req.body;
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: 'Prompt es requerido' });
    }

    const startTime = Date.now();
    const systemPrompt = engine?.systemPrompt || 'Eres un asistente de IA avanzado, analítico y veraz.';
    const temperature = typeof engine?.temperature === 'number' ? engine.temperature : 0.7;
    const system = `${systemPrompt}\n\nREGLA: Responde en el idioma del usuario (generalmente Español a menos que se solicite otro). Sé exhaustivo, estructurado con subtítulos claros y directo al punto.\n\n${ARTIFACT_RULES}`;

    let textOutput = '';
    if (engine?.provider === 'claude') {
      const input = prepareInput(String(prompt), context, files);
      textOutput = await callClaude({
        model: engine?.model || CLAUDE_DEFAULT_MODEL,
        system,
        text: input.text,
        media: input.media,
        maxTokens: 8192,
      });
    } else {
      const fullContent = buildContentsWithFiles(String(prompt), context, files);
      const response = await generateContentWithFallback({
        model: engine?.model || 'gemini-3.8-flash',
        contents: fullContent,
        config: {
          systemInstruction: system,
          temperature: Math.max(0.1, Math.min(1.2, temperature)),
        },
      });
      textOutput = response.text || '';
    }

    const latencyMs = Date.now() - startTime;
    return res.json({
      engineId: engine?.id || 'unknown',
      engineName: engine?.name || 'IA',
      response: textOutput || 'Sin respuesta generada.',
      latencyMs,
      status: 'completed',
    });
  } catch (error: any) {
    console.error('Error in /api/generate-engine:', error);
    return res.status(500).json({
      error: error?.message || 'Error al generar respuesta de IA',
      status: 'error',
    });
  }
});

/**
 * Run multiple AIs in parallel and return all individual results
 */
app.post('/api/orchestrate-parallel', async (req, res) => {
  try {
    const { prompt, engines, context, userProfile, files } = req.body;
    if (!prompt || !Array.isArray(engines) || engines.length === 0) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos (prompt y motores)' });
    }

    const enabledEngines = engines.filter((e: any) => e.enabled !== false).slice(0, 8);
    if (enabledEngines.length === 0) {
      return res.status(400).json({ error: 'Debe haber al menos un motor de IA activado' });
    }

    let profileInstruction = '';
    if (userProfile && userProfile.isActive) {
      profileInstruction = `\n\nPERFIL DEL USUARIO (${userProfile.name}):
- Actuá acorde a sus preferencias: ${userProfile.style}
- Negocios y contexto: ${userProfile.businesses?.join(' | ') || ''}
- Proyecto literario: ${userProfile.bookProject || ''}
- Directivas maestras personalizadas: ${userProfile.systemDirectives || ''}
- Reglas: Cero complacencia, sin respuestas condescendientes, sin emojis, directo y fundamentado. Preservá trabajo previo funcional.`;
    }

    // Prepare full contents including text and any media attachments
    const fullContent = buildContentsWithFiles(prompt, context, files);

    // Modo streaming (NDJSON): cada motor se emite apenas termina, de forma independiente
    const stream = req.query.stream === '1';
    if (stream) {
      res.status(200);
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
    }

    // Todos los motores corren en paralelo y aislados: ninguno ve ni modifica lo que hacen los demás
    const promises = enabledEngines.map(async (engine: any) => {
      const startTime = Date.now();
      const emit = <T extends { engineId: string }>(result: T): T => {
        if (stream && !res.writableEnded) res.write(JSON.stringify({ type: 'result', result }) + '\n');
        return result;
      };
      try {
        const systemPrompt = engine.systemPrompt || 'Eres una IA experta.';
        const temperature = typeof engine.temperature === 'number' ? engine.temperature : 0.7;

        const system = `${systemPrompt}${profileInstruction}\n\nDirectriz de rol: Asume plenamente tu perspectiva especializada (${engine.name} - ${engine.badge}). Responde de forma completa, estructurada y persuasiva.${userProfile?.isActive ? ' Utilizá español rioplatense natural y directo, sin emojis.' : ' Responde en el idioma del prompt.'}\n\n${ARTIFACT_RULES}`;
        let text: string;
        if (engine.provider === 'claude') {
          const input = prepareInput(prompt, context, files);
          text = await callClaude({
            model: engine.model || CLAUDE_DEFAULT_MODEL,
            system,
            text: input.text,
            media: input.media,
            maxTokens: 8192,
          });
        } else {
          const response = await generateContentWithFallback({
            model: engine.model || undefined,
            contents: fullContent,
            config: { systemInstruction: system, temperature: Math.max(0.1, Math.min(1.2, temperature)) },
          });
          text = response.text || '';
        }

        const latencyMs = Date.now() - startTime;
        return emit({
          engineId: engine.id,
          engineName: engine.name,
          response: text || 'Sin texto generado.',
          latencyMs,
          status: 'completed' as const,
        });
      } catch (err: any) {
        console.error(`Error querying engine ${engine.id}:`, err);
        return emit({
          engineId: engine.id,
          engineName: engine.name,
          response: '',
          latencyMs: Date.now() - startTime,
          status: 'error' as const,
          error: err?.message || 'Fallo en la llamada a la IA',
        });
      }
    });

    const results = await Promise.all(promises);
    if (stream) {
      res.write(JSON.stringify({ type: 'done' }) + '\n');
      return res.end();
    }
    return res.json({ results });
  } catch (error: any) {
    console.error('Error in /api/orchestrate-parallel:', error);
    if (res.headersSent) {
      res.write(JSON.stringify({ type: 'fatal', error: error?.message || 'Error en orquestación paralela' }) + '\n');
      return res.end();
    }
    return res.status(500).json({ error: error?.message || 'Error en orquestación paralela' });
  }
});

async function runArbiterChallenge(inputText: string, mediaFiles: any[]) {
  const challengeInstruction = `Eres el auditor adversarial previo del Árbitro Supremo.
Tu trabajo NO es resolver todavía la consulta. Tenés que atacar las respuestas candidatas: detectar contradicciones, afirmaciones sin respaldo, supuestos ocultos, lagunas críticas, riesgos de implementación y decisiones que podrían estar equivocadas.
Compará también la memoria persistente recibida, pero tratala como evidencia contextual y no como verdad.
Devolvé una auditoría estructurada que el Árbitro final usará para corregir su propia síntesis.`;

  const challengeSchema = {
    type: Type.OBJECT,
    properties: {
      keyClaimsToVerify: { type: Type.ARRAY, items: { type: Type.STRING } },
      contradictions: { type: Type.ARRAY, items: { type: Type.STRING } },
      unsupportedAssumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
      missingEvidence: { type: Type.ARRAY, items: { type: Type.STRING } },
      implementationRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
      resolutionHints: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: [
      'keyClaimsToVerify',
      'contradictions',
      'unsupportedAssumptions',
      'missingEvidence',
      'implementationRisks',
      'resolutionHints',
    ],
  };

  const prepared = prepareInput(inputText, undefined, mediaFiles);
  if (ARBITER === 'claude') {
    const obj = await callClaude({
      model: process.env.BRAIN_CRITIC_MODEL || 'claude-sonnet-5-5',
      system: challengeInstruction,
      text: prepared.text,
      media: prepared.media,
      schema: toJsonSchema(challengeSchema),
      maxTokens: 6000,
    });
    return obj;
  }

  const response = await generateContentWithFallback({
    model: process.env.BRAIN_CRITIC_MODEL || MODELS[1] || MODELS[0],
    contents: buildContentsWithFiles(inputText, undefined, mediaFiles),
    config: {
      systemInstruction: challengeInstruction,
      responseMimeType: 'application/json',
      responseSchema: challengeSchema,
      temperature: 0.15,
    },
  });
  return parseJsonPayload(response.text || '{}');
}

/**
 * Synthesize responses using the Supreme Arbiter
 */
app.post('/api/synthesize', async (req, res) => {
  try {
    const { prompt, criteria = 'balanced', responses, userProfile, files } = req.body;
    if (!prompt || !Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ error: 'Faltan respuestas para sintetizar' });
    }

    const validResponses = responses.filter(
      (r: any) => r.status === 'completed' && r.response && r.response.trim().length > 0
    );

    if (validResponses.length === 0) {
      return res.status(400).json({ error: 'No hay respuestas válidas completadas para analizar' });
    }

    const criteriaGuide = criteriaGuidelines[criteria] || criteriaGuidelines.balanced;

    // Brain loop: recall before reasoning. Memory is contextual evidence, not truth.
    const brainRecall = await recallBrain(req, prompt, 8).catch((error) => {
      console.warn('[Brain] recall omitido:', error?.message || error);
      return { userId: '', memories: [] };
    });
    const brainContext = formatBrainContext(brainRecall.memories);

    let profileContext = '';
    if (userProfile && userProfile.isActive) {
      profileContext = `PERFIL DEL USUARIO (${userProfile.name}):
- Estilo: ${userProfile.style} (Español rioplatense, sin emojis, directo, claro, profesional).
- Filosofía: IDEA → TECNOLOGÍA → NEGOCIO → EJECUCIÓN → CRECIMIENTO.
- Mandato: No dar respuestas complacientes ni elogios vacíos. Evaluar viabilidad económica, costos ocultos, dependencias operativas y mejoras incrementales antes de rehacer de cero.
- Negocios y contexto: ${userProfile.businesses?.join(' | ') || ''}
- Proyecto literario: ${userProfile.bookProject || ''}
- Directivas maestras personalizadas: ${userProfile.systemDirectives || ''}
\n`;
    }

    let filesNote = '';
    if (Array.isArray(files) && files.length > 0) {
      const notes = files.map((f: any) => {
        const mime = String(f?.type || '').toLowerCase();
        if (mime.startsWith('image/') || mime === 'application/pdf') {
          return `- ${f.name} (${mime}): archivo multimedia adjunto al Árbitro.`;
        }
        const raw = typeof f?.content === 'string' ? f.content : '';
        const excerpt = raw.length > 30_000 ? `${raw.slice(0, 30_000)}\n[Truncado para el Árbitro]` : raw;
        return `- ${f.name} (${mime || 'texto'}):\n${excerpt}`;
      });
      filesNote = `DOCUMENTOS/ARCHIVOS ADJUNTOS DISPONIBLES PARA EL ÁRBITRO:\n${notes.join('\n\n')}\n\n`;
    }

    // Build the comparative prompt
    let comparativeContext = `${profileContext}${filesNote}MEMORIA PERSISTENTE DEL CEREBRO (solo contexto; verificá antes de tratarla como un hecho):\n${brainContext}\n\nCONSULTA ORIGINAL DEL USUARIO:\n"${prompt}"\n\nCRITERIO DE ARBITRAJE SELECCIONADO:\n${criteriaGuide}\n\n--- RESPUESTAS DE LAS DIFERENTES IAs ---\n\n`;

    // Arbitraje ciego: el árbitro ve contribuciones anónimas (ia_1, ia_2...) y se reasignan al volver
    const labelMap: Record<string, any> = {};
    validResponses.forEach((r: any, idx: number) => {
      labelMap[`ia_${idx + 1}`] = r;
      comparativeContext += `### [IA #${idx + 1}] (ID: ia_${idx + 1}):\n${r.response}\n\n`;
    });

    let challengeReport: any = {};
    if (process.env.ARBITER_CHALLENGE !== 'false') {
      challengeReport = await runArbiterChallenge(comparativeContext, Array.isArray(files) ? files.filter((f: any) => {
        const mime = String(f?.type || '').toLowerCase();
        return mime.startsWith('image/') || mime === 'application/pdf';
      }) : []).catch((error) => {
        console.warn('[Brain] auditoría adversarial omitida:', error?.message || error);
        return {};
      });
    }

    const challengeContext = `\n\n--- AUDITORÍA ADVERSARIAL PREVIA ---\n${JSON.stringify(challengeReport, null, 2)}\n\nREGLA: resolvé primero las contradicciones y riesgos detectados por esta auditoría; no los ignores por conveniencia.`;
    comparativeContext += challengeContext;

    const arbiterInstruction = `Eres el Árbitro Supremo y Maestro Sintetizador de Inteligencia Artificial (AI Supreme Arbiter & Consensus Engine).
Tu misión es analizar con ojo crítico, imparcialidad y rigor técnico las diferentes respuestas generadas por los modelos de IA ante la consulta del usuario.
${userProfile?.isActive ? 'REGLA OBLIGATORIA DE REDACCIÓN: Hablá en español rioplatense con voseo natural (fijate, hacé, tené en cuenta), sin rodeos ni diplomacia innecesaria, y SIN ningún emoji. Sé directo, sincero y constructivo.' : ''}

${ARTIFACT_RULES}
Si la mejor solución es un artefacto (página, app, diagrama), incluilo completo y funcional dentro de finalMasterResponse en un único bloque de código.

COORDINACIÓN: las respuestas son contribuciones de colegas de igual jerarquía, presentadas de forma anónima (ia_1, ia_2...). Ninguna tiene prioridad por su origen: evaluá solo por mérito y construí UNA respuesta final conjunta que combine lo mejor de todas. En scores usá exactamente el ID recibido (ia_N) como engineId.

TUS TAREAS:
1. PUNTUACIÓN DE CADA IA (0 a 100):
   - accuracy (Exactitud técnica y veracidad)
   - depth (Profundidad, fundamentos y justificación)
   - practicality (Aplicabilidad directa, utilidad práctica)
   - clarity (Claridad estructural y redacción)
   - overallScore (Puntaje global ponderado según el criterio de arbitraje)
   - strengths: 2-3 puntos fuertes notables
   - weaknesses: 1-3 debilidades, omisiones o riesgos

2. IDENTIFICAR CONSENSOS:
   - consensusPoints: Aspectos clave en los que TODAS o la mayoría de las IAs concuerdan firmemente.

3. IDENTIFICAR DIVERGENCIAS & RESOLUCIÓN:
   - divergences: Temas donde las IAs discrepan o proponen caminos distintos, explicando cuál es la postura correcta o el compromiso óptimo.

4. DETECCIÓN DE PUNTOS CIEGOS O ERRORES:
   - blindspotsOrErrors: Lista de sesgos, asunciones no verificadas, omisiones graves o errores que cometió alguna de las IAs.

5. GENERAR "LA MEJOR VARIANTE" (finalMasterResponse):
   - Esta es la obra maestra: Una respuesta consolidada y pulida que SUPERA a cualquier respuesta individual.
   - Debe integrar lo mejor de cada perspectiva, resolver las contradicciones y ofrecer una solución integral, enriquecida con ejemplos o código si aplica, estructurada con títulos en Markdown, listas y tablas si es útil.

6. PLAN DE ACCIÓN Y CONCLUSIÓN:
   - actionPlan: 3 a 5 pasos concretos para ejecutar la solución.
   - keyTakeaway: Una máxima o regla de oro sintetizada.\n\n7. MEMORIA DEL CEREBRO:\n   - brainMemories: 0 a 5 recuerdos durables que mejoren futuras consultas.\n   - No guardes la respuesta completa, secretos, claves, tokens ni información efímera.\n   - Priorizá decisiones, preferencias estables, hechos del proyecto, restricciones, aprendizajes y errores corregidos.\n   - Cada recuerdo debe ser autocontenido y útil sin esta conversación.\n   - kind: fact, preference, decision, lesson, project, session_summary, artifact o feedback.\n   - supersedesId solo puede usar IDs que aparezcan en MEMORIA PERSISTENTE.\n   - Si la memoria vieja contradice evidencia actual, corregila; la memoria nunca sustituye la verificación.`;

    const synthSchema = {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Título conciso e impactante de la síntesis' },
            verdictSummary: { type: Type.STRING, description: 'Veredicto ejecutivo del Árbitro en 2-3 frases' },
            bestOverallAiId: { type: Type.STRING, description: 'ID de la IA con mejor rendimiento base o "hybrid"' },
            bestOverallAiName: { type: Type.STRING, description: 'Nombre de la IA ganadora o "Síntesis Híbrida"' },
            scores: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  engineId: { type: Type.STRING },
                  engineName: { type: Type.STRING },
                  accuracy: { type: Type.NUMBER },
                  depth: { type: Type.NUMBER },
                  practicality: { type: Type.NUMBER },
                  clarity: { type: Type.NUMBER },
                  overallScore: { type: Type.NUMBER },
                  strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                  weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'engineId',
                  'engineName',
                  'accuracy',
                  'depth',
                  'practicality',
                  'clarity',
                  'overallScore',
                  'strengths',
                  'weaknesses',
                ],
              },
            },
            consensusPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            divergences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING },
                  disagreement: { type: Type.STRING },
                  resolution: { type: Type.STRING },
                },
                required: ['topic', 'disagreement', 'resolution'],
              },
            },
            blindspotsOrErrors: { type: Type.ARRAY, items: { type: Type.STRING } },
            brainMemories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  kind: { type: Type.STRING },
                  content: { type: Type.STRING },
                  importance: { type: Type.NUMBER },
                  supersedesId: { type: Type.STRING },
                },
                required: ['kind', 'content', 'importance', 'supersedesId'],
              },
              description: 'Memorias durables para el cerebro persistente.',
            },
            finalMasterResponse: { type: Type.STRING, description: 'La solución definitiva unificada en Markdown' },
            actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
            keyTakeaway: { type: Type.STRING },
          },
          required: [
            'title',
            'verdictSummary',
            'bestOverallAiId',
            'bestOverallAiName',
            'scores',
            'consensusPoints',
            'divergences',
            'blindspotsOrErrors',
            'brainMemories',
            'finalMasterResponse',
            'actionPlan',
            'keyTakeaway',
          ],
        };

    const mediaFiles = Array.isArray(files)
      ? files.filter((f: any) => {
          const mime = String(f?.type || '').toLowerCase();
          return mime.startsWith('image/') || mime === 'application/pdf';
        })
      : [];
    const arbiterInput = prepareInput(comparativeContext, undefined, mediaFiles);
    let rawText: string;
    if (ARBITER === 'claude') {
      const obj = await callClaude({
        model: ARBITER_MODEL,
        system: arbiterInstruction,
        text: arbiterInput.text,
        media: arbiterInput.media,
        schema: toJsonSchema(synthSchema),
        maxTokens: 16000,
      });
      rawText = JSON.stringify(obj);
    } else {
      const response = await generateContentWithFallback({
        model: MODELS[0],
        contents: buildContentsWithFiles(comparativeContext, undefined, mediaFiles),
        config: { systemInstruction: arbiterInstruction, responseMimeType: 'application/json', responseSchema: synthSchema },
      });
      rawText = response.text || '{}';
    }
    const parsedData: any = parseJsonPayload(rawText);

    // Defensive fallback defaults
    if (!parsedData.title) parsedData.title = 'Síntesis Magistral de Consenso';
    if (!parsedData.verdictSummary) parsedData.verdictSummary = 'El Árbitro ha auditado y consolidado los puntos clave de cada IA.';
    if (!parsedData.bestOverallAiName) parsedData.bestOverallAiName = 'Síntesis Híbrida Equilibrada';
    if (!parsedData.bestOverallAiId) parsedData.bestOverallAiId = 'hybrid';
    if (!Array.isArray(parsedData.scores)) parsedData.scores = [];
    if (!Array.isArray(parsedData.consensusPoints)) parsedData.consensusPoints = ['Convergencia en la necesidad de estructurar la solución por fases.'];
    if (!Array.isArray(parsedData.divergences)) parsedData.divergences = [];
    if (!Array.isArray(parsedData.blindspotsOrErrors)) parsedData.blindspotsOrErrors = [];
    if (!Array.isArray(parsedData.brainMemories)) parsedData.brainMemories = [];
    if (!Array.isArray(parsedData.actionPlan)) parsedData.actionPlan = ['1. Evaluar requerimientos iniciales', '2. Implementar solución base', '3. Monitorizar rendimiento'];
    if (!parsedData.finalMasterResponse) parsedData.finalMasterResponse = rawText;
    if (!parsedData.keyTakeaway) parsedData.keyTakeaway = 'La mejor solución equilibra rigor técnico y velocidad de ejecución.';

    // Reasignar identidades reales a las puntuaciones anónimas
    const resolve = (id: string) => labelMap[String(id).toLowerCase().replace(/[^a-z0-9_]/g, '')];
    parsedData.scores = parsedData.scores
      .map((sc: any) => {
        const real = resolve(sc.engineId);
        return real ? { ...sc, engineId: real.engineId, engineName: real.engineName } : sc;
      })
      .filter((sc: any) => validResponses.some((r: any) => r.engineId === sc.engineId));
    const bestReal = resolve(parsedData.bestOverallAiId);
    if (bestReal) {
      parsedData.bestOverallAiId = bestReal.engineId;
      parsedData.bestOverallAiName = bestReal.engineName;
    }

    parsedData.evaluatedAt = new Date().toISOString();

    const brainSessionId = brainRecall.userId && isBrainCloudConfigured() ? crypto.randomUUID() : null;
    const recalledIds = new Set(brainRecall.memories.map((m) => m.id));
    const brainCandidates: BrainMemoryCandidate[] = Array.isArray(parsedData.brainMemories)
      ? parsedData.brainMemories
          .filter((m: any) => m && typeof m.content === 'string' && m.content.trim())
          .slice(0, 5)
          .map((m: any) => ({
            kind: m.kind,
            content: m.content,
            importance: m.importance,
            supersedesId: typeof m.supersedesId === 'string' ? m.supersedesId : undefined,
          }))
      : [];

    let savedMemoryIds: string[] = [];
    let savedBrainSessionId: string | null = null;
    if (brainSessionId) {
      savedMemoryIds = await rememberBrain(
        req,
        brainCandidates,
        { source: 'arbiter' },
        brainSessionId,
        recalledIds,
      );
      savedBrainSessionId = await saveBrainSession(req, prompt, criteria, parsedData, savedMemoryIds, brainSessionId);
    }

    delete parsedData.brainMemories;

    return res.json({
      synthesis: parsedData,
      brain: { connected: Boolean(savedBrainSessionId), recalled: brainRecall.memories.length, remembered: savedMemoryIds.length },
    });
  } catch (error: any) {
    console.error('Error in /api/synthesize:', error);
    return res.status(500).json({
      error: error?.message || 'Error al realizar el arbitraje de consenso',
    });
  }
});

/**
 * Debate or follow-up question endpoint
 */
app.post('/api/debate-followup', async (req, res) => {
  try {
    const { question, masterSynthesis, responses, previousPrompt, userProfile, files } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'Falta la pregunta de seguimiento' });
    }

    let profileContext = '';
    if (userProfile && userProfile.isActive) {
      profileContext = `PERFIL DEL USUARIO (${userProfile.name}):
- Hablá en español rioplatense (voseo: fijate, hacé, considerá), directo, claro, sin rodeos, sin diplomacia excesiva, SIN emojis.
- Filosofía: IDEA → TECNOLOGÍA → NEGOCIO → EJECUCIÓN → CRECIMIENTO.
- Directivas maestras personalizadas: ${userProfile.systemDirectives || ''}
- Cero complacencia: no busques agradar; detectá riesgos, costos ocultos y problemas no vistos.
\n`;
    }

    const priorResponses = Array.isArray(responses)
      ? responses
          .filter((r: any) => r?.status === 'completed' && typeof r?.response === 'string' && r.response.trim())
          .slice(0, 8)
          .map((r: any) => `### ${r.engineName || r.engineId}\n${r.response.slice(0, 12_000)}`)
          .join('\n\n')
      : '';
    const context = `${profileContext}CONTEXTO DEL DILEMA ANTERIOR:
Consulta original: "${previousPrompt || ''}"

SÍNTESIS PREVIA:
Título: ${masterSynthesis?.title || 'Síntesis previa'}
Resumen: ${masterSynthesis?.verdictSummary || ''}
Respuesta maestra:\n${masterSynthesis?.finalMasterResponse || ''}

PLAN DE ACCIÓN PREVIO:
${Array.isArray(masterSynthesis?.actionPlan) ? masterSynthesis.actionPlan.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n') : ''}

RESPUESTAS PREVIAS DE LAS IAs (referencia):
${priorResponses || 'No hay respuestas previas disponibles.'}

Instrucción: Como Árbitro Supremo y Coordinador Multi-IA, responde profundizando en la solución previa, corrigiendo errores si aparecen nuevos datos y aclarando el debate según lo solicite el usuario. Mantén un tono sumamente inteligente, analítico, sincero y práctico.${userProfile?.isActive ? ' Utilizá español rioplatense directo, sin emojis.' : ''}`;

    const fullContent = buildContentsWithFiles(question, context, files);

    let answer: string;
    if (ARBITER === 'claude') {
      const input = prepareInput(question, context, files);
      answer = await callClaude({
        model: ARBITER_MODEL,
        system: `${profileContext}${ARTIFACT_RULES}`,
        text: input.text,
        media: input.media,
        maxTokens: 8192,
      });
    } else {
      const response = await generateContentWithFallback({ model: undefined, contents: fullContent, config: { systemInstruction: ARTIFACT_RULES } });
      answer = response.text || '';
    }
    return res.json({ answer: answer || 'Sin respuesta.' });
  } catch (error: any) {
    console.error('Error in /api/debate-followup:', error);
    return res.status(500).json({ error: error?.message || 'Error en el seguimiento' });
  }
});

/**
 * Image generation endpoint with prompt enhancer & instant high-res visual generation
 */
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, style = 'photorealistic', aspectRatio = '1:1' } = req.body;
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: 'Falta la descripción para generar la imagen' });
    }
    if (!apiKey) {
      return res.status(503).json({ error: 'La generación de imágenes requiere GEMINI_API_KEY.' });
    }

    let enhancedPrompt = String(prompt).trim();
    try {
      const enhanceRes = await generateContentWithFallback({
        model: 'gemini-3.8-flash',
        contents: `Eres un director de arte visual y experto en prompts para IA generativa. Transforma esta idea en un prompt visual preciso, descriptivo y útil para Gemini Image. Conservá el objetivo y agregá composición, iluminación, materiales, cámara y ambiente cuando corresponda.\n\nIdea: "${String(prompt).trim()}"\nEstilo: "${style}"\nRegla: devolvé ÚNICAMENTE el prompt final, sin introducciones, Markdown ni comillas.`,
      });
      if (enhanceRes.text?.trim()) enhancedPrompt = enhanceRes.text.trim().replace(/^['\"`]+|['\"`]+$/g, '').trim();
    } catch (e) {
      console.warn('Se usará el prompt original para la generación de imagen:', e);
    }

    const aspectMap: Record<string, string> = { '1:1': '1:1', '16:9': '16:9', '9:16': '9:16', '4:3': '4:3' };
    const safeAspectRatio = aspectMap[aspectRatio] || '1:1';

    const response = await generateImageWithFallback({
      model: GEMINI_IMAGE_MODEL,
      contents: `${enhancedPrompt}\n\nVisual style: ${style}.\nCreate the final image only; do not describe it in text.`,
      config: {
        responseModalities: ['IMAGE'],
        responseFormat: { image: { aspectRatio: safeAspectRatio, imageSize: '2K' } },
      },
    });

    const parts = response?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) => part?.inlineData?.data);
    const imageData = imagePart?.inlineData?.data;
    const mimeType = imagePart?.inlineData?.mimeType || 'image/png';
    if (!imageData) {
      throw new Error('Gemini no devolvió una imagen válida. Probá con una descripción diferente.');
    }

    return res.json({
      imageUrl: `data:${mimeType};base64,${imageData}`,
      enhancedPrompt,
      originalPrompt: String(prompt).trim(),
      style,
      aspectRatio: safeAspectRatio,
      model: GEMINI_IMAGE_MODEL,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in /api/generate-image:', error);
    return res.status(500).json({ error: error?.message || 'Error al generar imagen con Gemini' });
  }
});

/**
 * Video storyboard & script generation endpoint
 */
app.post('/api/generate-video-storyboard', async (req, res) => {
  try {
    const { prompt, duration = '15s', style = 'cinematic', userProfile } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Falta la idea del video' });
    }

    let profileContext = '';
    if (userProfile && userProfile.isActive) {
      profileContext = `\nContexto: tono directo, enfocado a ${userProfile.name}, sin emojis.`;
    }

    const storyboardPrompt = `Eres un Director de Cine y Productor Audiovisual experto en IA de video (Sora, Runway Gen-3, Luma Dream Machine).
Crea un desglose cinematográfico completo para un video de ${duration} con estilo ${style} sobre la siguiente idea:${profileContext}
"${prompt}"

Genera una respuesta en formato JSON con la siguiente estructura exacta:
- title: Título atractivo del proyecto audiovisual
- concept: Sinopsis en 2 líneas del impacto visual
- masterPrompt: Prompt maestro optimizado en inglés para copiar en Sora/Runway Gen-3
- scenes: Lista de 3 a 4 escenas, cada una con:
  - sceneNumber: número (1, 2, ...)
  - durationSec: duración aproximada en segundos
  - shotType: Plano (Primer plano, Plano general, Vista cenital, etc.)
  - cameraMotion: Movimiento de cámara (Dolly in, Pan derecho, Travelling...)
  - visualDescription: Qué sucede visualmente con lujo de detalles
  - soundDesign: Música de fondo y efectos de sonido
  - voiceover: Texto de voz en off (en español rioplatense si hay perfil activo, o neutral)`;

    const response = await generateContentWithFallback({
      model: 'gemini-3.8-flash',
      contents: storyboardPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            concept: { type: Type.STRING },
            masterPrompt: { type: Type.STRING },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  durationSec: { type: Type.NUMBER },
                  shotType: { type: Type.STRING },
                  cameraMotion: { type: Type.STRING },
                  visualDescription: { type: Type.STRING },
                  soundDesign: { type: Type.STRING },
                  voiceover: { type: Type.STRING },
                },
                required: [
                  'sceneNumber',
                  'durationSec',
                  'shotType',
                  'cameraMotion',
                  'visualDescription',
                  'soundDesign',
                  'voiceover',
                ],
              },
            },
          },
          required: ['title', 'concept', 'masterPrompt', 'scenes'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    
    // Add visual preview image URLs for each scene
    if (Array.isArray(parsed.scenes)) {
      parsed.scenes = parsed.scenes.map((sc: any, idx: number) => {
        const scenePrompt = `${sc.visualDescription}, cinematic, 8k, ${style}`;
        const seed = Math.floor(Math.random() * 999999) + idx;
        return {
          ...sc,
          previewImageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(scenePrompt)}?width=800&height=450&seed=${seed}&nologo=true`,
        };
      });
    }

    return res.json({ storyboard: parsed });
  } catch (error: any) {
    console.error('Error in /api/generate-video-storyboard:', error);
    return res.status(500).json({ error: error?.message || 'Error al generar guión de video' });
  }
});

// Configure Vite or Static files
async function startServer() {
  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');

    // PWA metadata and service worker must always be revalidated so a new
    // deployment can be discovered promptly by installed browsers.
    app.get('/manifest.webmanifest', (_req, res) => {
      res.type('application/manifest+json').set('Cache-Control', 'no-cache').sendFile(path.resolve(distDir, 'manifest.webmanifest'));
    });
    app.get('/sw.js', (_req, res) => {
      res.type('application/javascript').set('Cache-Control', 'no-cache').sendFile(path.resolve(distDir, 'sw.js'));
    });

    app.use(express.static(distDir, {
      maxAge: '1y',
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html') || filePath.endsWith('offline.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    }));

    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distDir, 'index.html'), {
        headers: { 'Cache-Control': 'no-cache' },
      });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ConsensusAI server listening on http://0.0.0.0:${PORT}`);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught exception:', error);
});

startServer().catch((error) => {
  console.error('[Startup] No se pudo iniciar OmniSynth AI:', error);
  process.exitCode = 1;
});
