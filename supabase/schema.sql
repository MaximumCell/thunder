-- Thunder — Step 5 schema (Supabase Auth + DB).
-- Run this once in the Supabase Dashboard SQL Editor (Project > SQL Editor >
-- New query > paste > Run). Not applied automatically — this session has no
-- direct DB/DDL access, only the anon/service REST keys.

-- ── profiles ─────────────────────────────────────────────────────────────
-- One row per auth.users row. Holds the display name collected at signup
-- (kept out of user_metadata so it's queryable/RLS-able like everything else).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: select own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create a profile row when a user signs up. The name is passed as
-- signUp() options.data.name (raw_user_meta_data) from the signup form.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── conversations ────────────────────────────────────────────────────────
-- One per project (/app/[projectId]).
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;

create policy "conversations: owner all" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── messages ─────────────────────────────────────────────────────────────
-- The conversational agent's chat history per conversation.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "messages: owner all" on public.messages
  for all using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- ── generation_tasks ─────────────────────────────────────────────────────
-- One per canvas node (prompt/image/video). parent_id is the edge — the
-- node this one was generated from — so the canvas graph (nodes + edges +
-- positions) can be rebuilt exactly on reload.
create table if not exists public.generation_tasks (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  parent_id uuid references public.generation_tasks (id) on delete set null,
  type text not null check (type in ('prompt', 'image', 'video')),
  status text not null default 'completed' check (status in ('queued', 'generating', 'completed', 'error')),
  label text,
  prompt text,
  media_url text,
  ratio text,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.generation_tasks enable row level security;

create policy "generation_tasks: owner all" on public.generation_tasks
  for all using (
    exists (
      select 1 from public.conversations c
      where c.id = generation_tasks.conversation_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.conversations c
      where c.id = generation_tasks.conversation_id and c.user_id = auth.uid()
    )
  );

-- ── usage_logs ───────────────────────────────────────────────────────────
-- Structure only — Step 7 builds the actual tracking logic. Left empty.
create table if not exists public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  generation_task_id uuid references public.generation_tasks (id) on delete set null,
  model text,
  tokens integer,
  cost_usd numeric(10, 4),
  created_at timestamptz not null default now()
);

alter table public.usage_logs enable row level security;

create policy "usage_logs: owner all" on public.usage_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── generation_references ───────────────────────────────────────────────
-- Manual node-to-node connections (canvas "connect two existing nodes to
-- pass a reference"). See 002_generation_references.sql for the standalone
-- migration — kept here too so a fresh install gets everything in one run.
create table if not exists public.generation_references (
  id uuid primary key default gen_random_uuid(),
  generation_task_id uuid not null references public.generation_tasks (id) on delete cascade,
  reference_task_id uuid not null references public.generation_tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (generation_task_id, reference_task_id)
);

alter table public.generation_references enable row level security;

create policy "generation_references: owner all" on public.generation_references
  for all using (
    exists (
      select 1 from public.generation_tasks t
      join public.conversations c on c.id = t.conversation_id
      where t.id = generation_references.generation_task_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.generation_tasks t
      join public.conversations c on c.id = t.conversation_id
      where t.id = generation_references.generation_task_id and c.user_id = auth.uid()
    )
  );
