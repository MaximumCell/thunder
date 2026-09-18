-- Thunder — Step 7 (Usage Tracking) breakdown view support. Additive
-- migration — run once in the Supabase Dashboard SQL Editor.

-- Distinguishes the cheap/free conversational agent (Gemma) from the real
-- cost driver (BytePlus generation) — the two were never split before.
alter table public.usage_logs
  add column if not exists source text not null default 'byteplus'
    check (source in ('gemma', 'byteplus'));

-- Every usage entry now ties back to "which project" directly — Gemma
-- chat-turn usage isn't tied to a specific canvas node (generation_task_id
-- stays nullable, used only for BytePlus entries), so conversation_id is
-- the one field every row can always carry.
alter table public.usage_logs
  add column if not exists conversation_id uuid references public.conversations (id) on delete cascade;
