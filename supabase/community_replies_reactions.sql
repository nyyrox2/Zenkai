-- Zenkai community: replies + emoji reactions. ADDITIVE ONLY: no existing column, table, policy or function is changed.
-- The old APK keeps working (it never sends or reads the new fields). Safe to run more than once.

-- 1) Replies: two new nullable columns on community_posts.
alter table public.community_posts add column if not exists reply_to text;
alter table public.community_posts add column if not exists reply_snap jsonb; -- {"name": "...", "text": "..."} fallback if the original is out of view

-- 2) Reactions: new table (the heart/likes column + like_community_post RPC stay untouched).
create table if not exists public.community_reactions (
  post_id    text not null,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  emoji      text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);
create index if not exists community_reactions_post_idx on public.community_reactions (post_id);

alter table public.community_reactions enable row level security;
drop policy if exists "reactions readable" on public.community_reactions;
drop policy if exists "react as yourself" on public.community_reactions;
drop policy if exists "remove own reaction" on public.community_reactions;
create policy "reactions readable" on public.community_reactions for select using (true);
create policy "react as yourself" on public.community_reactions for insert to authenticated with check (auth.uid() = user_id);
create policy "remove own reaction" on public.community_reactions for delete to authenticated using (auth.uid() = user_id);

-- 3) One call returns the counts for a channel's recent posts (+ whether the caller reacted).
create or replace function public.get_community_reactions(p_category text)
returns table (post_id text, emoji text, n bigint, mine boolean)
language sql stable
as $$
  select r.post_id, r.emoji, count(*) as n, coalesce(bool_or(r.user_id = auth.uid()), false) as mine
  from public.community_reactions r
  where r.post_id in (
    select p.id::text from public.community_posts p
    where p.category = p_category
    order by p.created_at desc limit 200
  )
  group by r.post_id, r.emoji;
$$;
grant execute on function public.get_community_reactions(text) to anon, authenticated;

-- 4) Unsending a message also clears its reactions (trigger on delete; does not alter the table).
create or replace function public.community_posts_cleanup_reactions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.community_reactions where post_id = old.id::text;
  return old;
end $$;
drop trigger if exists community_posts_cleanup_reactions on public.community_posts;
create trigger community_posts_cleanup_reactions after delete on public.community_posts
  for each row execute function public.community_posts_cleanup_reactions();
