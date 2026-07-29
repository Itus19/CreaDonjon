-- Migration 002 — comptes et mondes (SCHEMA.md §3).

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  locale       text not null default 'fr',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger touch_profiles_updated_at
  before update on profiles
  for each row execute function app.touch_updated_at();

-- profiles est cree par trigger sur auth.users. Ne jamais lire auth.users
-- directement depuis l'application (SCHEMA.md §3).
create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

create table worlds (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text not null,
  owner_id            uuid not null references auth.users(id),
  default_ruleset_id  uuid,                                -- FK ajoutee en migration 004
  calendar            jsonb not null default '{}'::jsonb,  -- un seul calendrier par monde en V1
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  unique (owner_id, slug)
);

create trigger touch_worlds_updated_at
  before update on worlds
  for each row execute function app.touch_updated_at();

-- Prepare le multi-MJ sans le construire (SCHEMA.md §3) : une table
-- aujourd'hui, plutot qu'une reecriture de toutes les politiques RLS plus tard.
create table world_members (
  world_id  uuid not null references worlds(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null check (role in ('owner','editor','viewer')),
  added_at  timestamptz not null default now(),
  primary key (world_id, user_id)
);
