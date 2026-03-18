-- Run this in your Supabase project: SQL Editor → New query → paste & run

-- Portfolio positions
create table if not exists portfolio (
  id         uuid    default gen_random_uuid() primary key,
  user_id    uuid    references auth.users not null,
  ticker     text    not null,
  shares     numeric not null,
  avg_cost   numeric not null,
  created_at timestamptz default now()
);
alter table portfolio enable row level security;
create policy "Users manage own portfolio" on portfolio
  for all using (auth.uid() = user_id);

-- Price alerts
create table if not exists alerts (
  id         uuid    default gen_random_uuid() primary key,
  user_id    uuid    references auth.users not null,
  ticker     text    not null,
  condition  text    not null, -- 'above' | 'below'
  price      numeric not null,
  triggered  boolean default false,
  created_at timestamptz default now()
);
alter table alerts enable row level security;
create policy "Users manage own alerts" on alerts
  for all using (auth.uid() = user_id);
