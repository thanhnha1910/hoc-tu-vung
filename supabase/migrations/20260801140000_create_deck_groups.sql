create table public.deck_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(owner_id, name)
);

alter table public.deck_groups enable row level security;

create policy "Users can manage their own deck groups" on public.deck_groups
  for all using (auth.uid() = owner_id);
