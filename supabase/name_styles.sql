-- Name cosmetics (effect / font / colour) must live on public.profiles so other people see them
-- on the ranking, chat, party and profile pages. Run once in the Supabase SQL editor; safe to re-run.
alter table public.profiles
  add column if not exists equipped_text_effect text,
  add column if not exists equipped_font_style  text,
  add column if not exists equipped_title       text,
  add column if not exists equipped_frame       text,
  add column if not exists name_color           text;

-- make PostgREST pick up the new columns immediately
notify pgrst, 'reload schema';
