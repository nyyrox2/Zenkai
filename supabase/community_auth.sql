-- Zenkai: only logged-in users can post in the community; everyone can read.
-- Run once in the Supabase SQL editor.
do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'public' and tablename = 'community_posts'
  loop
    execute format('drop policy %I on public.community_posts', r.policyname);
  end loop;
end $$;

alter table public.community_posts enable row level security;

create policy "anyone can read" on public.community_posts for select using (true);
create policy "members can post" on public.community_posts for insert to authenticated
  with check (auth.uid() = user_id);
create policy "edit own posts" on public.community_posts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own posts" on public.community_posts for delete to authenticated
  using (auth.uid() = user_id);
-- Likes go through the like_community_post RPC, so they are not affected by these policies (it must be security definer).

-- Remove every old guest message (posts with no account behind them).
delete from public.community_posts where user_id is null;
