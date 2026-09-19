-- Thunder — reference-image attachments. Additive migration — run once in the
-- Supabase Dashboard SQL Editor BEFORE deploying the code that reads/writes it.

-- Cloudinary URLs of the user-attached reference images a node was generated
-- with, so reloading a project still shows what references were used.
alter table public.generation_tasks
  add column if not exists reference_urls text[] not null default '{}';
