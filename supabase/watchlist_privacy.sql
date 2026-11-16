-- Watchlist privacy for Zenkai profiles.
-- Run once in the Supabase SQL editor.

-- 1) Each user chooses whether their watchlist is private (default: public).
alter table public.profiles
  add column if not exists watchlist_private boolean not null default false;

-- 2) What other people can read. This view runs with the owner's rights, so visitors never touch
--    user_sync directly. For a private watchlist the database returns NULL: the data never leaves the server.
create or replace view public.public_watchlists as
select
  s.user_id,
  case when coalesce(p.watchlist_private, false) then null else s.watchlist end    as watchlist,
  case when coalesce(p.watchlist_private, false) then null else s.custom_lists end as custom_lists,
  coalesce(p.watchlist_private, false)                                              as is_private
from public.user_sync s
left join public.profiles p on p.id = s.user_id;

grant select on public.public_watchlists to anon, authenticated;

-- 3) Keep the raw table closed. user_sync should only allow a user to read their own row
--    (Table Editor > user_sync > Policies). Do not add a policy with "using (true)", it would bypass privacy.
