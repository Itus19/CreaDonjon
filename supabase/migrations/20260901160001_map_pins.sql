-- Lot I, phase C (ADR 0017 decision 1) — punaises d'une carte.
--
-- `block_id`, jamais `entity_id` : une punaise appartient au bloc `map`
-- PROPRIETAIRE qui porte l'image (mode "own"), jamais a la fiche qui
-- l'affiche — un bloc "ref" partage donc les memes punaises que sa source,
-- sans copie (voir ADR 0017, "modifier une punaise sur le bloc proprietaire
-- la modifie partout ou elle est referencee").
--
-- `ref` (jsonb, BlockReference | null) et `label` (texte libre) sont
-- INDEPENDANTS l'un de l'autre (retour utilisateur, point 1 des reponses
-- Lot I) : le lien renvoie vers une fiche existante, le nom s'affiche que
-- ce lien existe ou non — jamais l'un derive de l'autre.
--
-- Visibilite propre a chaque punaise (retour utilisateur, point 3) : memes
-- 6 niveaux que blocks/assets. Le filtrage par couche (ADR 0017 decision 2,
-- "ET jamais l'un sans l'autre") arrive avec `layer_id`/Phase E ; `layer_id`
-- est deja la colonne ici (nullable, sans contrainte de cle etrangere tant
-- que `map_layers` n'existe pas — Phase E ajoutera la contrainte dans une
-- nouvelle migration, jamais celle-ci modifiee).

create or replace function app.block_entity_id(p_block uuid)
returns uuid
language sql stable security definer set search_path = public, app as $$
  select entity_id from blocks where id = p_block;
$$;

revoke execute on function app.block_entity_id(uuid) from public;
grant execute on function app.block_entity_id(uuid) to authenticated;

create table map_pins (
  id       uuid primary key default gen_random_uuid(),
  block_id uuid not null references blocks(id) on delete cascade,

  -- Coordonnees normalisees (0-1), memes conventions que MapView
  -- (src/core/schemas/blocks/map.ts) — jamais des pixels, casserait a
  -- chaque remplacement d'image.
  x numeric not null check (x >= 0 and x <= 1),
  y numeric not null check (y >= 0 and y <= 1),

  label text not null default '',
  ref   jsonb,
  size  text not null default 'medium' check (size in ('small','medium','large')),

  layer_id uuid,

  visibility_level    text not null default 'public'
    check (visibility_level in ('public','players','gm','campaign','user','private')),
  visibility_scope_id uuid,

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint map_pins_visibility_scope_ck check (
    (visibility_level in ('campaign','user') and visibility_scope_id is not null)
    or (visibility_level not in ('campaign','user') and visibility_scope_id is null)
  )
);

create index map_pins_block_idx on map_pins (block_id);

create trigger touch_map_pins_updated_at
  before update on map_pins
  for each row execute function app.touch_updated_at();

alter table map_pins enable row level security;

create policy map_pins_select on map_pins for select
  using (
    app.is_world_member(app.entity_world_id(app.block_entity_id(block_id)))
    and app.visibility_permits(
      app.entity_world_id(app.block_entity_id(block_id)),
      visibility_level,
      visibility_scope_id,
      created_by
    )
  );

-- Ecrire une punaise est une edition du bloc `map` qui la porte, meme garde
-- que blocks_insert/update/delete (migration 20260830110001).
create policy map_pins_insert on map_pins for insert
  with check (app.can_edit_entity(app.block_entity_id(block_id)));
create policy map_pins_update on map_pins for update
  using (app.can_edit_entity(app.block_entity_id(block_id)))
  with check (app.can_edit_entity(app.block_entity_id(block_id)));
create policy map_pins_delete on map_pins for delete
  using (app.can_edit_entity(app.block_entity_id(block_id)));
