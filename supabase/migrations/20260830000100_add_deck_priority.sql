  -- Let learners softly prioritize decks in the global Daily Session queue.
  alter table public.decks
    add column if not exists is_priority boolean not null default false;

  create index if not exists decks_owner_priority_idx
    on public.decks(owner_id, is_priority);
