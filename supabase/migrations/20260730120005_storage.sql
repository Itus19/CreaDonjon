-- Migration 011 — fichiers et partage (SCHEMA.md §18).
--
-- entity_assets est decrite en §7.1 mais reportee ici : elle reference
-- assets(id), qui n'existe qu'a partir de cette migration (note de
-- sequencement laissee dans la migration 003).

create table assets (
  id           uuid primary key default gen_random_uuid(),
  world_id     uuid not null references worlds(id) on delete cascade,
  storage_path text not null unique,
  mime_type    text not null,
  byte_size    bigint not null,
  width        int,
  height       int,
  alt_text     text,
  visibility_level text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,
  uploaded_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create table entity_assets (
  entity_id     uuid not null references entities(id) on delete cascade,
  asset_id      uuid not null references assets(id) on delete cascade,
  role          text not null check (role in ('portrait','banner','gallery','map')),
  display_order numeric not null default 1000,
  primary key (entity_id, asset_id)
);

-- Supabase Storage, buckets prives, URLs signees de courte duree : un
-- bucket public reduirait a neant le travail sur la visibilite.
create table share_links (
  id          uuid primary key default gen_random_uuid(),
  world_id    uuid not null references worlds(id) on delete cascade,
  campaign_id uuid references campaigns(id) on delete cascade,
  token_hash  text not null unique,
  scope       text not null check (scope in ('public_only','players')),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
