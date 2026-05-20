-- ============================================================
-- Học Từ Vựng — Supabase schema (run in SQL editor of your project)
-- ============================================================
-- This creates: decks, cards, review_logs + Row Level Security so
-- each user can only read/write their own data.
-- Re-run is safe (uses CREATE ... IF NOT EXISTS).
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "uuid-ossp";

-- ---------- decks ----------
create table if not exists public.decks (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  source_lang   text not null default 'en',
  target_lang   text not null default 'vi',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists decks_owner_idx on public.decks(owner_id);

-- ---------- cards ----------
create table if not exists public.cards (
  id              uuid primary key default uuid_generate_v4(),
  deck_id         uuid not null references public.decks(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,

  term            text not null,
  definition      text not null,
  example         text,
  pronunciation   text,
  image_url       text,

  -- FSRS state
  state           text not null default 'new'
                  check (state in ('new','learning','review','relearning')),
  due             timestamptz not null default now(),
  stability       double precision not null default 0,
  difficulty      double precision not null default 0,
  elapsed_days    integer not null default 0,
  scheduled_days  integer not null default 0,
  reps            integer not null default 0,
  lapses          integer not null default 0,
  last_review     timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists cards_deck_idx  on public.cards(deck_id);
create index if not exists cards_owner_due_idx on public.cards(owner_id, due);

-- ---------- review_logs ----------
create table if not exists public.review_logs (
  id                  uuid primary key default uuid_generate_v4(),
  card_id             uuid not null references public.cards(id) on delete cascade,
  owner_id            uuid not null references auth.users(id) on delete cascade,
  rating              smallint not null check (rating between 1 and 4),
  state               text not null,
  due                 timestamptz not null,
  stability           double precision not null,
  difficulty          double precision not null,
  elapsed_days        integer not null,
  last_elapsed_days   integer not null,
  scheduled_days      integer not null,
  mode                text not null,
  reviewed_at         timestamptz not null default now()
);
create index if not exists review_logs_card_idx  on public.review_logs(card_id, reviewed_at desc);
create index if not exists review_logs_owner_idx on public.review_logs(owner_id, reviewed_at desc);

-- ---------- updated_at trigger ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists decks_updated_at on public.decks;
create trigger decks_updated_at before update on public.decks
  for each row execute function public.set_updated_at();

drop trigger if exists cards_updated_at on public.cards;
create trigger cards_updated_at before update on public.cards
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security: a user can only see/edit their own rows
-- ============================================================
alter table public.decks       enable row level security;
alter table public.cards       enable row level security;
alter table public.review_logs enable row level security;

drop policy if exists "decks_owner_all" on public.decks;
create policy "decks_owner_all" on public.decks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "cards_owner_all" on public.cards;
create policy "cards_owner_all" on public.cards
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "review_logs_owner_all" on public.review_logs;
create policy "review_logs_owner_all" on public.review_logs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
