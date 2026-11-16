-- Zenkai: close the back doors around private watchlists.
-- Run watchlist_privacy.sql first. Then work through the steps below one at a time.

------------------------------------------------------------------------------------------
-- STEP 1 (read only): see who is allowed to read and edit what right now.
-- Look for any row on user_sync / watchlist whose qual is "true" (or has no qual) for SELECT,
-- and any UPDATE policy on profiles that is not limited to (auth.uid() = id).
------------------------------------------------------------------------------------------
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('user_sync', 'watchlist', 'watch_history', 'profiles')
order by tablename, cmd;

------------------------------------------------------------------------------------------
-- STEP 2: raw watchlist tables readable only by their owner.
-- Drops every existing policy on these two tables, then allows a user to touch only their own rows.
-- (The privacy view still works: it runs with the owner's rights, not the visitor's.)
------------------------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and tablename in ('user_sync', 'watchlist')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.user_sync enable row level security;
alter table public.watchlist enable row level security;

create policy "own rows only" on public.user_sync
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.watchlist
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

------------------------------------------------------------------------------------------
-- STEP 3: nobody can flip someone else's privacy switch (or edit their profile).
-- Profiles stay publicly readable (public profile pages need that); only the owner can write.
------------------------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy %I on public.profiles', r.policyname);
  end loop;
end $$;

alter table public.profiles enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
