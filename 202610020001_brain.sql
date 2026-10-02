-- OmniSynth Brain: persistent semantic memory + session summaries.
-- Run this migration in Supabase SQL Editor.

create extension if not exists vector with schema extensions;

create table if not exists public.brain_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('fact','preference','decision','lesson','project','session_summary','artifact','feedback')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  importance smallint not null default 5 check (importance between 1 and 10),
  embedding extensions.vector(768),
  source_session_id uuid,
  supersedes_id uuid references public.brain_memories(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz
);

create index if not exists brain_memories_user_active_idx
  on public.brain_memories (user_id, is_active, importance desc, created_at desc);

create index if not exists brain_memories_embedding_hnsw_idx
  on public.brain_memories
  using hnsw (embedding vector_cosine_ops);

create table if not exists public.brain_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  criteria text,
  synthesis jsonb not null,
  memory_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists brain_sessions_user_created_idx
  on public.brain_sessions (user_id, created_at desc);


alter table public.brain_memories
  add constraint brain_memories_source_session_fk
  foreign key (source_session_id) references public.brain_sessions(id) on delete set null;

create table if not exists public.brain_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.brain_sessions(id) on delete set null,
  rating smallint check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.brain_memories enable row level security;
alter table public.brain_sessions enable row level security;
alter table public.brain_feedback enable row level security;

-- The web client authenticates first, while the OmniSynth server uses the
-- service role only after verifying the user's JWT. Keep direct table access
-- locked down; the public client does not receive the service role.
revoke all on public.brain_memories from anon, authenticated;
revoke all on public.brain_sessions from anon, authenticated;
revoke all on public.brain_feedback from anon, authenticated;

create or replace function public.match_brain_memories(
  p_user_id uuid,
  p_query_embedding extensions.vector(768),
  p_match_threshold float default 0.52,
  p_match_count int default 8
)
returns table (
  id uuid,
  kind text,
  content text,
  metadata jsonb,
  importance smallint,
  similarity float,
  source_session_id uuid,
  supersedes_id uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    bm.id,
    bm.kind,
    bm.content,
    bm.metadata,
    bm.importance,
    1 - (bm.embedding <=> p_query_embedding) as similarity,
    bm.source_session_id,
    bm.supersedes_id,
    bm.created_at
  from public.brain_memories bm
  where bm.user_id = p_user_id
    and bm.is_active = true
    and bm.embedding is not null
    and 1 - (bm.embedding <=> p_query_embedding) >= p_match_threshold
  order by
    bm.embedding <=> p_query_embedding,
    bm.importance desc,
    bm.created_at desc
  limit greatest(1, least(p_match_count, 20));
$$;

revoke all on function public.match_brain_memories(uuid, extensions.vector(768), float, int) from public, anon, authenticated;
grant execute on function public.match_brain_memories(uuid, extensions.vector(768), float, int) to service_role;
