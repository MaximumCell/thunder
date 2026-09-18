-- Thunder — keep the original (expiring) BytePlus video_url around for
-- reference/debugging even after Step 6 re-hosts the permanent copy on
-- Cloudinary into media_url. Additive migration — run once in the
-- Supabase Dashboard SQL Editor.
alter table public.generation_tasks
  add column if not exists byteplus_url text;
