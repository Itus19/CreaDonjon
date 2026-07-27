-- Phase 0 schema: worlds, entities, blocks, relations, rulesets, campaigns.
-- See Phase0_Schema_Technique_v0_1.md for the design rationale.

create extension if not exists pgcrypto;

-- Shared trigger: keep updated_at current on row updates.
create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 6. rulesets
create table rulesets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_system text not null,
  parent_ruleset_id uuid references rulesets(id),
  version int not null default 1,
  is_official_base boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index rulesets_parent_ruleset_id_idx on rulesets(parent_ruleset_id);

-- 1. worlds
create table worlds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id),
  default_ruleset_id uuid references rulesets(id),
  created_at timestamptz not null default now()
);

create index worlds_owner_id_idx on worlds(owner_id);

-- 2. entities
create table entities (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references worlds(id),
  name text not null,
  aliases text[] not null default '{}',
  summary text,
  narrative_content jsonb not null default '[]',
  tags text[] not null default '{}',
  entity_kind text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index entities_world_id_idx on entities(world_id);

create trigger entities_set_updated_at
  before update on entities
  for each row
  execute function set_updated_at();

-- 4. blocks
create table blocks (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  block_type text not null,
  data jsonb not null default '{}',
  visibility text not null default 'public',
  display_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blocks_entity_id_idx on blocks(entity_id);

create trigger blocks_set_updated_at
  before update on blocks
  for each row
  execute function set_updated_at();

-- 5. relations
create table relations (
  id uuid primary key default gen_random_uuid(),
  source_entity_id uuid not null references entities(id) on delete cascade,
  target_entity_id uuid not null references entities(id) on delete cascade,
  relation_type text not null,
  metadata jsonb not null default '{}',
  visibility text not null default 'public'
);

create index relations_source_entity_id_idx on relations(source_entity_id);
create index relations_target_entity_id_idx on relations(target_entity_id);

-- 7. ruleset_entries
create table ruleset_entries (
  id uuid primary key default gen_random_uuid(),
  ruleset_id uuid not null references rulesets(id) on delete cascade,
  entry_type text not null,
  human_readable jsonb not null default '{}',
  structured_data jsonb not null default '{}'
);

create index ruleset_entries_ruleset_id_idx on ruleset_entries(ruleset_id);

-- 8. entity_mechanical_revisions
create table entity_mechanical_revisions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references entities(id) on delete cascade,
  revision_number int not null,
  mechanical_data jsonb not null default '{}',
  based_on_ruleset_entry_id uuid references ruleset_entries(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (entity_id, revision_number)
);

create index entity_mechanical_revisions_entity_id_idx on entity_mechanical_revisions(entity_id);

-- revision_number is per-entity, not a global sequence: compute it on insert.
create function set_next_revision_number()
returns trigger
language plpgsql
as $$
begin
  if new.revision_number is null then
    select coalesce(max(revision_number), 0) + 1
      into new.revision_number
      from entity_mechanical_revisions
      where entity_id = new.entity_id;
  end if;
  return new;
end;
$$;

create trigger entity_mechanical_revisions_set_revision_number
  before insert on entity_mechanical_revisions
  for each row
  execute function set_next_revision_number();

-- entities.current_mechanical_revision_id: added after entity_mechanical_revisions
-- exists, since the two tables reference each other.
alter table entities
  add column current_mechanical_revision_id uuid references entity_mechanical_revisions(id);

-- 9. campaigns
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references worlds(id),
  name text not null,
  ruleset_id uuid not null references rulesets(id),
  gm_user_id uuid not null references auth.users(id),
  mode text not null default 'campagne',
  created_at timestamptz not null default now()
);

create index campaigns_world_id_idx on campaigns(world_id);

-- 10. campaign_members
create table campaign_members (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null,
  primary key (campaign_id, user_id)
);

-- 11. campaign_entity_snapshots
create table campaign_entity_snapshots (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  entity_id uuid not null references entities(id) on delete cascade,
  mechanical_revision_id uuid not null references entity_mechanical_revisions(id),
  primary key (campaign_id, entity_id)
);
