-- Thunder — manual node-to-node references (canvas "connect two existing
-- nodes to pass a reference" feature). Additive to schema.sql — run this
-- once in the Supabase Dashboard SQL Editor alongside/after schema.sql.

-- One row per manual connection: generation_task_id is the node that gains
-- an extra reference; reference_task_id is the node being referenced (e.g.
-- a video/image dragged into an existing prompt node). Separate from
-- generation_tasks.parent_id, which stays the single-parent creation
-- lineage — this is an additional, optional many-to-many link.
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
