alter table public.decks add column if not exists group_name text;

create index if not exists decks_owner_group_idx
  on public.decks(owner_id, group_name);
