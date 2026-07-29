-- Migration 005 — campagnes et parties (SCHEMA.md §11).

create table campaigns (
  id         uuid primary key default gen_random_uuid(),
  world_id   uuid not null references worlds(id) on delete cascade,
  name       text not null,
  ruleset_id uuid not null references rulesets(id),   -- version precise epinglee
  gm_user_id uuid references auth.users(id),          -- null en solo, le MJ est l'IA
  mode       text not null check (mode in ('campaign','solo')),
  rng_seed   text not null default encode(gen_random_bytes(16),'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger touch_campaigns_updated_at
  before update on campaigns
  for each row execute function app.touch_updated_at();

create table campaign_members (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('gm','player')),
  joined_at   timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table campaign_characters (
  campaign_id uuid not null references campaigns(id) on delete cascade,
  entity_id   uuid not null references entities(id) on delete cascade,
  user_id     uuid references auth.users(id),   -- null = PNJ controle par le MJ
  is_pc       boolean not null default true,
  primary key (campaign_id, entity_id)
);

-- mechanical_revision_id n'a pas encore de FK ici : entity_mechanical_revisions
-- est cree en migration 006 (meme situation que la FK circulaire
-- entities.current_mechanical_revision_id). La contrainte est ajoutee la-bas.
create table campaign_entity_snapshots (
  campaign_id            uuid not null references campaigns(id) on delete cascade,
  entity_id              uuid not null references entities(id) on delete cascade,
  mechanical_revision_id uuid not null,
  pinned_at              timestamptz not null default now(),
  primary key (campaign_id, entity_id)
);
