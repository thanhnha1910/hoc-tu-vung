create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  preferred_hour smallint not null default 20 check (preferred_hour between 0 and 23),
  enabled boolean not null default true,
  last_notified_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_owner_idx
  on public.push_subscriptions(owner_id);
create index if not exists push_subscriptions_enabled_idx
  on public.push_subscriptions(enabled, preferred_hour);

drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_owner_all" on public.push_subscriptions;
create policy "push_subscriptions_owner_all" on public.push_subscriptions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
