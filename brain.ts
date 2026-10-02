import type { Request } from 'express';
import crypto from 'node:crypto';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export type BrainMemoryKind =
  | 'fact'
  | 'preference'
  | 'decision'
  | 'lesson'
  | 'project'
  | 'session_summary'
  | 'artifact'
  | 'feedback';

export interface BrainMemoryCandidate {
  kind: BrainMemoryKind;
  content: string;
  importance: number;
  supersedesId?: string;
}

export interface BrainRecall {
  id: string;
  kind: BrainMemoryKind;
  content: string;
  metadata: Record<string, unknown>;
  importance: number;
  similarity: number;
  sourceSessionId?: string | null;
  supersedesId?: string | null;
  createdAt: string;
}

function getSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '').trim();
  return { url, key, configured: Boolean(url && key) };
}

function getAdmin(): SupabaseClient | null {
  const { url, key, configured } = getSupabaseConfig();
  if (!configured) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const isBrainCloudConfigured = () => getSupabaseConfig().configured;

function getEmbeddingConfig() {
  return {
    model: process.env.BRAIN_EMBEDDING_MODEL || 'gemini-embedding-2',
    dimensions: Number(process.env.BRAIN_EMBEDDING_DIMENSIONS || '768'),
  };
}

function bearerToken(req: Request): string | null {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : null;
}

export async function verifyBrainUser(req: Request): Promise<User | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const token = bearerToken(req);
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

async function createEmbedding(text: string): Promise<number[] | null> {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || !text.trim()) return null;

  const embedding = getEmbeddingConfig();
  const ai = new GoogleGenAI({ apiKey: key });
  const response = await ai.models.embedContent({
    model: embedding.model,
    contents: text.slice(0, 12000),
    config: { outputDimensionality: embedding.dimensions },
  });
  const values = response.embeddings?.[0]?.values;
  return Array.isArray(values) && values.length === embedding.dimensions ? values : null;
}

export async function recallBrain(
  req: Request,
  query: string,
  matchCount = 8,
): Promise<{ userId: string; memories: BrainRecall[] }> {
  const user = await verifyBrainUser(req);
  const admin = getAdmin();
  if (!user || !admin) return { userId: '', memories: [] };

  const embedding = await createEmbedding(query).catch((error) => {
    console.warn('[Brain] no se pudo generar embedding:', error?.message || error);
    return null;
  });

  if (embedding) {
    const { data, error } = await admin.rpc('match_brain_memories', {
      p_user_id: user.id,
      p_query_embedding: embedding,
      p_match_threshold: Number(process.env.BRAIN_MATCH_THRESHOLD || '0.52'),
      p_match_count: Math.max(1, Math.min(matchCount, 20)),
    });
    if (!error && Array.isArray(data)) {
      const memories = data.map((row: any) => ({
        id: String(row.id),
        kind: String(row.kind) as BrainMemoryKind,
        content: String(row.content),
        metadata: (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>,
        importance: Number(row.importance || 5),
        similarity: Number(row.similarity || 0),
        sourceSessionId: row.source_session_id || null,
        supersedesId: row.supersedes_id || null,
        createdAt: String(row.created_at),
      }));
      if (memories.length) {
        await touchMemories(memories.map((m) => m.id));
        return { userId: user.id, memories };
      }
    }
    if (error) console.warn('[Brain] búsqueda vectorial falló:', error.message);
  }

  // Fallback: recent high-importance memories keep the brain useful even when embeddings are unavailable.
  const { data, error } = await admin
    .from('brain_memories')
    .select('id,kind,content,metadata,importance,source_session_id,supersedes_id,created_at')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('importance', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(matchCount, 20)));

  if (error) {
    console.warn('[Brain] fallback de memoria falló:', error.message);
    return { userId: user.id, memories: [] };
  }

  return {
    userId: user.id,
    memories: (data || []).map((row: any) => ({
      id: String(row.id),
      kind: String(row.kind) as BrainMemoryKind,
      content: String(row.content),
      metadata: (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>,
      importance: Number(row.importance || 5),
      similarity: 0,
      sourceSessionId: row.source_session_id || null,
      supersedesId: row.supersedes_id || null,
      createdAt: String(row.created_at),
    })),
  };
}

async function touchMemories(ids: string[]) {
  const admin = getAdmin();
  if (!admin || !ids.length) return;
  await admin
    .from('brain_memories')
    .update({ last_accessed_at: new Date().toISOString() })
    .in('id', ids);
}

export async function rememberBrain(
  req: Request,
  candidates: BrainMemoryCandidate[],
  metadata: Record<string, unknown> = {},
  sourceSessionId?: string,
  allowedSupersedesIds: Set<string> = new Set(),
): Promise<string[]> {
  const user = await verifyBrainUser(req);
  const admin = getAdmin();
  if (!user || !admin || !Array.isArray(candidates) || !candidates.length) return [];

  const safe = candidates
    .filter((c) => c && typeof c.content === 'string' && c.content.trim())
    .slice(0, 5)
    .map((c) => ({
      kind: c.kind,
      content: c.content.trim().slice(0, 5000),
      importance: Math.max(1, Math.min(10, Math.round(Number(c.importance) || 5))),
      supersedesId: c.supersedesId && allowedSupersedesIds.has(c.supersedesId) ? c.supersedesId : null,
    }));

  const inserted: string[] = [];
  for (const item of safe) {
    const { data: duplicate } = await admin
      .from('brain_memories')
      .select('id')
      .eq('user_id', user.id)
      .eq('kind', item.kind)
      .eq('content', item.content)
      .eq('is_active', true)
      .maybeSingle();
    if (duplicate?.id) continue;
    let embedding: number[] | null = null;
    try {
      embedding = await createEmbedding(item.content);
    } catch (error: any) {
      console.warn('[Brain] embedding de memoria omitido:', error?.message || error);
    }

    const row: Record<string, unknown> = {
      user_id: user.id,
      kind: item.kind,
      content: item.content,
      metadata,
      importance: item.importance,
      source_session_id: sourceSessionId || null,
      supersedes_id: item.supersedesId,
      is_active: true,
    };
    if (embedding) row.embedding = embedding;

    const { data, error } = await admin
      .from('brain_memories')
      .insert(row)
      .select('id')
      .single();
    if (error) {
      console.warn('[Brain] no se pudo guardar una memoria:', error.message);
      continue;
    }
    inserted.push(String(data.id));

    if (item.supersedesId) {
      await admin
        .from('brain_memories')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', item.supersedesId)
        .eq('user_id', user.id);
    }
  }

  return inserted;
}

export async function saveBrainSession(
  req: Request,
  prompt: string,
  criteria: string,
  synthesis: unknown,
  memoryIds: string[],
  sessionId = crypto.randomUUID(),
): Promise<string | null> {
  const user = await verifyBrainUser(req);
  const admin = getAdmin();
  if (!user || !admin) return null;

  const { data, error } = await admin
    .from('brain_sessions')
    .insert({
      id: sessionId,
      user_id: user.id,
      prompt: prompt.slice(0, 12000),
      criteria: criteria.slice(0, 100),
      synthesis,
      memory_ids: memoryIds,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[Brain] no se pudo guardar la sesión:', error.message);
    return null;
  }
  return String(data.id);
}

export async function forgetBrain(req: Request, memoryId?: string): Promise<number> {
  const user = await verifyBrainUser(req);
  const admin = getAdmin();
  if (!user || !admin) return 0;

  let query = admin.from('brain_memories').delete({ count: 'exact' }).eq('user_id', user.id);
  if (memoryId) query = query.eq('id', memoryId);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function brainStats(req: Request): Promise<{ configured: boolean; connected: boolean; memoryCount: number }> {
  const admin = getAdmin();
  if (!admin) return { configured: false, connected: false, memoryCount: 0 };
  const user = await verifyBrainUser(req);
  if (!user) return { configured: true, connected: false, memoryCount: 0 };

  const { count, error } = await admin
    .from('brain_memories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true);

  return { configured: true, connected: !error, memoryCount: count || 0 };
}

export function formatBrainContext(memories: BrainRecall[]): string {
  if (!memories.length) {
    return 'No hay recuerdos relevantes almacenados. No inventes memoria previa.';
  }

  return memories
    .map(
      (m, index) =>
        `[MEMORIA ${index + 1} | ${m.kind} | importancia ${m.importance} | similitud ${m.similarity ? m.similarity.toFixed(3) : 'n/a'} | id ${m.id}]\n${m.content}`,
    )
    .join('\n\n');
}
