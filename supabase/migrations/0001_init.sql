-- SaralSaathi initial schema.
-- PRIVACY: never store raw API keys (only sha256 hashes) and never store documents or results.

create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  prefs jsonb not null,
  updated_at timestamptz default now()
);

alter table public.preferences enable row level security;

create policy "own preferences: select" on public.preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own preferences: insert" on public.preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own preferences: update" on public.preferences
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions (id) on delete cascade,
  key_hash text unique not null, -- sha256 hex of the raw key; the raw key is shown once and never stored
  label text,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

create index if not exists api_keys_institution_id_idx on public.api_keys (institution_id);

-- RLS on, no policies: only the service role (server) can read or write these.
alter table public.institutions enable row level security;
alter table public.api_keys enable row level security;
